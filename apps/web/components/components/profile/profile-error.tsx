interface ProfileErrorProps {
  message: string;
}

export function ProfileError({
  message,
}: ProfileErrorProps) {
  return (
    <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
      <div className="mx-auto max-w-md px-4 pb-10 pt-10">
        <div className="rounded-2xl border border-[#3A2634] bg-[#1D1829] p-5">
          <h1 className="text-lg font-semibold">
            Unable to load profile
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#9088A0]">
            {message}
          </p>
        </div>
      </div>
    </main>
  );
}