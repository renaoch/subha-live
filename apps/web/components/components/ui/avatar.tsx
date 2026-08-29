import { cn } from "@/lib/utils";
import { gradientFor } from "@/lib/mock-data";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
}

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
};

export function Avatar({
  name,
  src,
  size = "md",
  online,
  className,
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    // FIX: size, clipping (overflow-hidden + rounded-full), and any
    // border passed in via `className` now all live on the SAME element.
    // Previously the outer wrapper took `className` (so a caller's
    // `h-10 w-10 border-2 ...` landed here) while the actual circular,
    // clipped image was a separate INNER div sized independently by
    // `size` (e.g. "md" = h-12 w-12). If a caller's className size
    // didn't match the size prop's px value, the inner circle was
    // literally bigger than the outer box and spilled out past it —
    // that's the square "box" edge that was visible behind the avatar.
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white",
        SIZES[size],
        !src && gradientFor(name),
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        initials
      )}

      {online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-400" />
      )}
    </div>
  );
}