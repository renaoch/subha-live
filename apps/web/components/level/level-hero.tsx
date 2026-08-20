import type { LevelProgress } from "@/lib/api/levels";

interface LevelHeroProps {
  progress: LevelProgress;
}

export function LevelHero({
  progress,
}: LevelHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#342348] via-[#24192F] to-[#19151F] p-6 shadow-2xl">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
          Current level
        </div>

        <div className="flex items-end gap-3">
          <span className="text-6xl font-black leading-none">
            {progress.currentLevel}
          </span>

          {progress.currentTitle && (
            <span className="pb-1 text-sm font-medium text-purple-200/70">
              {progress.currentTitle}
            </span>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">
              {progress.totalXp.toLocaleString()} XP
            </span>

            {progress.nextLevelXp !== null && (
              <span className="text-white/40">
                {progress.nextLevelXp.toLocaleString()} XP
              </span>
            )}
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-400 transition-all duration-700"
              style={{
                width: `${progress.progress}%`,
              }}
            />
          </div>
        </div>

        {progress.nextLevel !== null && (
          <div className="mt-3 text-xs text-white/40">
            {progress.progress}% toward Level{" "}
            {progress.nextLevel}
            {progress.nextTitle
              ? ` · ${progress.nextTitle}`
              : ""}
          </div>
        )}
      </div>
    </section>
  );
}