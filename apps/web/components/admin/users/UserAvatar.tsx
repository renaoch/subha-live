import { cn } from "@/lib/utils";

const TONES = ["#7b3fe4", "#d6336c", "#2f6fdb", "#12a07a", "#c46a0a", "#8a3fbf"];

/** Avatar image with a coloured-initial fallback (so every row has a face). */
export function UserAvatar({
  name,
  src,
  size = 44,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const tone = TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote user avatar
    <img src={src} alt={name} style={style} className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/10", className)} />
  ) : (
    <span
      style={{ ...style, background: tone }}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-white/10", className)}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
