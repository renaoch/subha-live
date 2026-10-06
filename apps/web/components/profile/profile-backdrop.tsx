// Decorative, pointer-events-none backdrop for the Me tab: deep violet base,
// aurora glows (violet / pink / gold / cyan), a faint dotted grid and a
// vignette so cards pop. Pure CSS — no effect on layout or data.
export function ProfileBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <style>{`
        @keyframes pb-drift-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(24px,18px,0) scale(1.12); } }
        @keyframes pb-drift-b { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-22px,26px,0) scale(1.1); } }
        @media (prefers-reduced-motion: reduce) { .pb-blob { animation: none !important; } }
      `}</style>

      {/* base gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#2A1650_0%,#170F2E_38%,#0E0A18_100%)]" />

      {/* aurora blobs */}
      <span className="pb-blob absolute -left-24 -top-16 h-72 w-72 rounded-full bg-[#8B5CF6]/45 blur-[90px]" style={{ animation: "pb-drift-a 14s ease-in-out infinite" }} />
      <span className="pb-blob absolute -right-28 top-24 h-72 w-72 rounded-full bg-[#FF4F93]/30 blur-[90px]" style={{ animation: "pb-drift-b 17s ease-in-out infinite" }} />
      <span className="pb-blob absolute left-1/3 top-[42%] h-64 w-64 rounded-full bg-[#F5B93F]/18 blur-[100px]" style={{ animation: "pb-drift-a 20s ease-in-out infinite" }} />
      <span className="pb-blob absolute -left-20 bottom-24 h-72 w-72 rounded-full bg-[#27D3FF]/18 blur-[100px]" style={{ animation: "pb-drift-b 18s ease-in-out infinite" }} />

      {/* faint dotted grid, fading out downward */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(180deg, #000 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 60%)",
        }}
      />

      {/* bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0E0A18] to-transparent" />
    </div>
  );
}