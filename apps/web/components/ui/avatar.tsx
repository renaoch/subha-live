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
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white",
          SIZES[size],
          !src && gradientFor(name),
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
      </div>

      {online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-400" />
      )}
    </div>
  );
}