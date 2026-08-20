export function LevelLoading() {
  return (
    <main className="min-h-dvh bg-[#17131F] px-4 py-6 text-[#F3ECE0]">
      <div className="mx-auto max-w-md space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-28 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-48 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-40 animate-pulse rounded-3xl bg-white/5" />
      </div>
    </main>
  );
}