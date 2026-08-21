// File: components/agency/stat-tile.tsx

interface StatTileProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
  sm: {
    wrap: "rounded-xl bg-white/[0.025] px-3 py-2.5",
    label: "text-[7px] tracking-wider",
    value: "mt-1 text-xs font-bold text-white/60",
  },
  md: {
    wrap: "rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4",
    label: "text-[8px] tracking-[0.2em]",
    value: "mt-1 text-lg font-black text-white",
  },
  lg: {
    wrap: "rounded-[24px] border border-white/[0.07] bg-[#15111B] p-5",
    label: "text-[9px] tracking-[0.2em]",
    value: "mt-2 text-2xl font-black text-white",
  },
} as const;

export function StatTile({ label, value, icon, size = "md" }: StatTileProps) {
  const s = SIZE_STYLES[size];

  return (
    <div className={s.wrap}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-[#D9A94A]/60">{icon}</span>}
        <p className={`font-black uppercase text-white/20 ${s.label}`}>{label}</p>
      </div>
      <p className={s.value}>{value}</p>
    </div>
  );
}