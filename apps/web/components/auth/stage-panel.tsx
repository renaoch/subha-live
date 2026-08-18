import { Mic, Radio, Sparkles, Users } from "lucide-react";

const LIVE_NOW = [
  { initials: "AD", from: "from-fuchsia-400", to: "to-violet-500" },
  { initials: "SL", from: "from-amber-300", to: "to-rose-400" },
  { initials: "MR", from: "from-sky-300", to: "to-indigo-500" },
];

export function StagePanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-Subha-gradient p-10">
      {/* ambient mesh + spotlight glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-72 w-72 rotate-6 rounded-full bg-white/10 blur-3xl animate-float-slow" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="absolute bottom-10 left-0 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
        {/* subtle grid so the panel doesn't read as flat gradient */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        {/* vignette so foreground content stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
      </div>

      <div className="relative flex items-center gap-2 text-white">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
          <Radio className="h-4 w-4" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">
          Subha
        </span>
      </div>

      {/* centerpiece illustration: on-air mic stage, not a stock photo */}
      <div className="relative mx-auto flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
        <span className="absolute h-full w-full rounded-full border border-white/10" />
        <span className="absolute h-[80%] w-[80%] rounded-full border border-white/10" />
        <span className="absolute h-[60%] w-[60%] animate-pulse-ring rounded-full bg-fuchsia-400/20" />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10 shadow-panel backdrop-blur-md sm:h-32 sm:w-32">
          <Mic className="h-11 w-11 text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.45)]" />
        </div>
        <span className="absolute -top-1 right-6 flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ON AIR
        </span>
        <Sparkles className="absolute -left-2 bottom-2 h-5 w-5 text-amber-200/80" />
      </div>

      <div className="relative">
        <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] text-white sm:text-5xl">
          Every room
          <br />
          has a seat
          <br />
          <span className="bg-gradient-to-r from-fuchsia-200 to-amber-100 bg-clip-text text-transparent">
            for you.
          </span>
        </h1>
        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
          Step into live video rooms, audio hangouts, and PK battles with
          people tuning in from everywhere, right now.
        </p>
      </div>

      <div className="relative flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {LIVE_NOW.map((p) => (
              <span
                key={p.initials}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 bg-gradient-to-br ${p.from} ${p.to} text-[11px] font-semibold text-white`}
              >
                {p.initials}
              </span>
            ))}
          </div>
          <div className="text-white">
            <p className="text-sm font-semibold leading-none">2.4K live</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-white/65">
              <Users className="h-3 w-3" /> streaming right now
            </p>
          </div>
        </div>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-rose-300" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
        </span>
      </div>
    </div>
  );
}
