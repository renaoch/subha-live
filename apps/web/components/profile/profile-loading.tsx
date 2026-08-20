export function ProfileLoading() {
  return (
    <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-6">
        {/* Hero skeleton */}
        <section className="pt-4">
          <div className="flex items-center gap-4">
            <div className="h-[76px] w-[76px] shrink-0 animate-pulse rounded-full bg-[#2A2238]" />

            <div className="min-w-0 flex-1">
              <div className="h-7 w-36 animate-pulse rounded-lg bg-[#2A2238]" />

              <div className="mt-2 h-5 w-24 animate-pulse rounded-full bg-[#2A2238]" />

              <div className="mt-2 h-4 w-28 animate-pulse rounded bg-[#2A2238]" />
            </div>
          </div>

          <div className="mt-5 h-20 animate-pulse rounded-2xl bg-[#1D1829]" />
        </section>

        {/* VIP skeleton */}
        <div className="h-[72px] animate-pulse rounded-2xl bg-[#1D1829]" />

        {/* Wallet skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[78px] animate-pulse rounded-2xl bg-[#1D1829]" />
          <div className="h-[78px] animate-pulse rounded-2xl bg-[#1D1829]" />
        </div>

        {/* Menu skeleton */}
        <div className="h-[210px] animate-pulse rounded-2xl bg-[#1D1829]" />

        {/* Support skeleton */}
        <div className="h-[68px] animate-pulse rounded-2xl bg-[#1D1829]" />
      </div>
    </main>
  );
}