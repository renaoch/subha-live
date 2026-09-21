// apps/web/lib/camera-filters.ts
//
// Single source of truth for the host's camera filters.
//
// Each preset is described ONCE, as an ordered list of CSS-filter-style
// operations. From that one description we derive:
//   1. `css`    – a CSS `filter` string (thumbnails, and the local-preview
//                 fallback when WebGL isn't available), and
//   2. `matrix` – a 3x3 colour matrix + offset that the WebGL pipeline in
//                 filtered-camera.ts applies to the outgoing video frames.
//
// Because both come from the same ops, what the host sees in their preview
// and what viewers receive over WebRTC are the same look.
//
// The matrices follow the W3C Filter Effects Module Level 1 definitions of
// brightness / contrast / saturate / grayscale / sepia / hue-rotate, so the
// GPU output matches the equivalent CSS `filter` functions.

export type FilterOpName =
  | "brightness"
  | "contrast"
  | "saturate"
  | "grayscale"
  | "sepia"
  | "hue-rotate";

export interface FilterOp {
  fn: FilterOpName;
  /** brightness/contrast/saturate: multiplier. grayscale/sepia: 0..1.
   *  hue-rotate: degrees. */
  value: number;
}

export interface CameraFilterPreset {
  name: string;
  ops: FilterOp[];
}

export const CAMERA_FILTERS = [
  { name: "Natural", ops: [] },
  {
    name: "Glow",
    ops: [
      { fn: "brightness", value: 1.08 },
      { fn: "saturate", value: 1.08 },
      { fn: "contrast", value: 0.96 },
    ],
  },
  {
    name: "Warm",
    ops: [
      { fn: "sepia", value: 0.16 },
      { fn: "saturate", value: 1.18 },
      { fn: "brightness", value: 1.04 },
    ],
  },
  {
    name: "Cool",
    ops: [
      { fn: "hue-rotate", value: 10 },
      { fn: "saturate", value: 0.88 },
      { fn: "brightness", value: 1.04 },
    ],
  },
  {
    name: "Fresh",
    ops: [
      { fn: "brightness", value: 1.06 },
      { fn: "saturate", value: 1.22 },
      { fn: "contrast", value: 1.03 },
      { fn: "hue-rotate", value: 6 },
    ],
  },
  {
    name: "Rose",
    ops: [
      { fn: "sepia", value: 0.12 },
      { fn: "hue-rotate", value: -14 },
      { fn: "saturate", value: 1.25 },
      { fn: "brightness", value: 1.05 },
    ],
  },
  {
    name: "Vintage",
    ops: [
      { fn: "sepia", value: 0.28 },
      { fn: "saturate", value: 0.82 },
      { fn: "contrast", value: 0.94 },
      { fn: "brightness", value: 1.04 },
    ],
  },
  {
    name: "Noir",
    ops: [
      { fn: "grayscale", value: 1 },
      { fn: "contrast", value: 1.18 },
      { fn: "brightness", value: 0.94 },
    ],
  },
] as const satisfies readonly CameraFilterPreset[];

export type CameraFilterName = (typeof CAMERA_FILTERS)[number]["name"];

export const DEFAULT_CAMERA_FILTER: CameraFilterName = "Natural";

export function getCameraFilter(name: string): CameraFilterPreset {
  return (
    (CAMERA_FILTERS as readonly CameraFilterPreset[]).find((f) => f.name === name) ??
    CAMERA_FILTERS[0]
  );
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function opToCss(op: FilterOp): string {
  return op.fn === "hue-rotate"
    ? `hue-rotate(${op.value}deg)`
    : `${op.fn}(${op.value})`;
}

/** CSS `filter` value for a preset name ("none" for Natural / unknown). */
export function cameraFilterCss(name: string): string {
  const preset = getCameraFilter(name);
  return preset.ops.length ? preset.ops.map(opToCss).join(" ") : "none";
}

// ---------------------------------------------------------------------------
// Colour matrix (row-major 3x3 + offset), composed in op order
// ---------------------------------------------------------------------------

export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Vec3 = [number, number, number];

export interface ColorTransform {
  /** Row-major 3x3: out.r = m[0]*r + m[1]*g + m[2]*b + o[0], etc. */
  m: Mat3;
  o: Vec3;
}

const IDENTITY: ColorTransform = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], o: [0, 0, 0] };

function opTransform(op: FilterOp): ColorTransform {
  switch (op.fn) {
    case "brightness": {
      const b = op.value;
      return { m: [b, 0, 0, 0, b, 0, 0, 0, b], o: [0, 0, 0] };
    }
    case "contrast": {
      const c = op.value;
      const off = 0.5 - 0.5 * c;
      return { m: [c, 0, 0, 0, c, 0, 0, 0, c], o: [off, off, off] };
    }
    case "saturate": {
      const s = op.value;
      return {
        m: [
          0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
          0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
          0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
        ],
        o: [0, 0, 0],
      };
    }
    case "grayscale": {
      const s = 1 - Math.min(1, Math.max(0, op.value));
      return {
        m: [
          0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s,
          0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s,
          0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s,
        ],
        o: [0, 0, 0],
      };
    }
    case "sepia": {
      const s = 1 - Math.min(1, Math.max(0, op.value));
      return {
        m: [
          0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s,
          0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s,
          0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s,
        ],
        o: [0, 0, 0],
      };
    }
    case "hue-rotate": {
      const a = (op.value * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      return {
        m: [
          0.213 + cos * 0.787 - sin * 0.213,
          0.715 - cos * 0.715 - sin * 0.715,
          0.072 - cos * 0.072 + sin * 0.928,
          0.213 - cos * 0.213 + sin * 0.143,
          0.715 + cos * 0.285 + sin * 0.14,
          0.072 - cos * 0.072 - sin * 0.283,
          0.213 - cos * 0.213 - sin * 0.787,
          0.715 - cos * 0.715 + sin * 0.715,
          0.072 + cos * 0.928 + sin * 0.072,
        ],
        o: [0, 0, 0],
      };
    }
  }
}

/** Apply `next` after `prev`: out = next.m * (prev.m * x + prev.o) + next.o */
function compose(prev: ColorTransform, next: ColorTransform): ColorTransform {
  const a = next.m;
  const b = prev.m;
  const m = new Array<number>(9) as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      m[r * 3 + c] =
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  const o: Vec3 = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    o[r] =
      a[r * 3] * prev.o[0] + a[r * 3 + 1] * prev.o[1] + a[r * 3 + 2] * prev.o[2] + next.o[r];
  }
  return { m, o };
}

/** The whole preset collapsed into one colour transform. */
export function cameraFilterTransform(name: string): ColorTransform {
  return getCameraFilter(name).ops.reduce<ColorTransform>(
    (acc, op) => compose(acc, opTransform(op)),
    IDENTITY,
  );
}