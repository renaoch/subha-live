// apps/web/lib/filtered-camera.ts
//
// Bakes a colour filter INTO the video that gets published, so every viewer
// (and the PK opponent) receives the filtered picture — not just the host's
// local <video> element.
//
//   raw camera track ─▶ hidden <video> ─▶ WebGL canvas (colour-matrix shader)
//                                            └─▶ canvas.captureStream() ─▶ published track
//
// Why WebGL and not `CanvasRenderingContext2D.filter`: 2D-canvas `filter` is
// unsupported in Safari/iOS WebViews, which would silently give iOS hosts an
// unfiltered stream. A tiny fragment shader works everywhere WebGL does and
// runs on the GPU.
//
// Changing the filter mid-stream only swaps two shader uniforms — the
// published track is the same object throughout, so there is no
// renegotiation and no glitch for viewers.
//
// `createFilteredCamera` returns null when WebGL / captureStream isn't
// available; the caller then keeps publishing the raw camera track and
// falls back to a CSS-only local preview.

import { cameraFilterTransform, DEFAULT_CAMERA_FILTER } from "@/lib/camera-filters";

export interface FilteredCamera {
  /** Filtered video track + the original audio tracks. Publish this. */
  stream: MediaStream;
  /** Switch the active filter. Takes effect on the next frame. */
  setFilter: (name: string) => void;
  /** Stops the render loop AND the underlying raw camera tracks. */
  destroy: () => void;
}

const VERTEX_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 1.0 - (a_pos.y * 0.5 + 0.5));
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform mat3 u_m;
uniform vec3 u_o;
void main() {
  vec3 rgb = texture2D(u_tex, v_uv).rgb;
  gl_FragColor = vec4(clamp(u_m * rgb + u_o, 0.0, 1.0), 1.0);
}`;

const TARGET_FPS = 30;

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

export function createFilteredCamera(
  raw: MediaStream,
  initialFilter: string = DEFAULT_CAMERA_FILTER,
): FilteredCamera | null {
  if (typeof document === "undefined") return null;

  const rawVideoTrack = raw.getVideoTracks()[0];
  if (!rawVideoTrack) return null;

  const canvas = document.createElement("canvas");
  if (typeof canvas.captureStream !== "function") return null;

  const settings = rawVideoTrack.getSettings();
  canvas.width = settings.width || 720;
  canvas.height = settings.height || 1280;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // Some browsers only emit captureStream frames reliably from a WebGL
    // canvas when its buffer is preserved between draws.
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  // Hidden <video> that decodes the raw camera stream so it can be uploaded
  // as a texture. Kept in the DOM (1px, transparent) because some mobile
  // WebViews won't reliably advance frames on a detached element.
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("playsinline", "");
  video.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  video.srcObject = new MediaStream([rawVideoTrack]);
  document.body.appendChild(video);
  video.play().catch(() => {
    // Autoplay of a muted, inline stream is allowed; ignore transient rejects.
  });

  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let mLoc: WebGLUniformLocation | null = null;
  let oLoc: WebGLUniformLocation | null = null;
  let contextLost = false;
  let destroyed = false;
  let currentFilter = initialFilter;

  function initGl() {
    if (!gl) return;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const prog = gl.createProgram();
    if (!prog) throw new Error("createProgram failed");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.useProgram(prog);
    program = prog;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.uniform1i(gl.getUniformLocation(prog, "u_tex"), 0);
    mLoc = gl.getUniformLocation(prog, "u_m");
    oLoc = gl.getUniformLocation(prog, "u_o");
    applyFilterUniforms();
  }

  function applyFilterUniforms() {
    if (!gl || !mLoc || !oLoc) return;
    const { m, o } = cameraFilterTransform(currentFilter);
    // WebGL1 requires transpose=false, so hand the row-major matrix over
    // as column-major (out[c*3 + r] = m[r*3 + c]).
    const columnMajor = new Float32Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) columnMajor[c * 3 + r] = m[r * 3 + c];
    }
    gl.uniformMatrix3fv(mLoc, false, columnMajor);
    gl.uniform3f(oLoc, o[0], o[1], o[2]);
  }

  try {
    initGl();
  } catch {
    video.srcObject = null;
    video.remove();
    return null;
  }

  function draw() {
    if (!gl || !program || contextLost) return;
    if (video.readyState < 2 /* HAVE_CURRENT_DATA */) return;

    // Track the real camera resolution (it can change, e.g. on rotation).
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh && (canvas.width !== vw || canvas.height !== vh)) {
      canvas.width = vw;
      canvas.height = vh;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      return; // Frame not uploadable yet; try again next tick.
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Render loop, capped at TARGET_FPS so we don't burn battery re-drawing
  // faster than the camera produces frames.
  let rafId = 0;
  let lastDraw = 0;
  const minInterval = 1000 / TARGET_FPS - 2;
  function loop(now: number) {
    if (destroyed) return;
    if (now - lastDraw >= minInterval) {
      lastDraw = now;
      draw();
    }
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
  };
  const onContextRestored = () => {
    try {
      initGl();
      contextLost = false;
    } catch {
      // Leave contextLost = true; the last good frame stays on the track.
    }
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  const canvasStream = canvas.captureStream(TARGET_FPS);
  const filteredTrack = canvasStream.getVideoTracks()[0];
  if (!filteredTrack) {
    destroyed = true;
    cancelAnimationFrame(rafId);
    video.srcObject = null;
    video.remove();
    return null;
  }
  try {
    filteredTrack.contentHint = "detail";
  } catch {
    // Not supported everywhere; harmless.
  }

  const stream = new MediaStream([filteredTrack, ...raw.getAudioTracks()]);

  return {
    stream,
    setFilter(name: string) {
      currentFilter = name;
      applyFilterUniforms();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      try {
        filteredTrack.stop();
      } catch {
        // Already stopped.
      }
      // Stop the real camera so the hardware light goes off.
      for (const track of raw.getVideoTracks()) {
        try {
          track.stop();
        } catch {
          // Already stopped.
        }
      }
      video.srcObject = null;
      video.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}