interface LevelErrorProps {
  message: string;
}

export function LevelError({
  message,
}: LevelErrorProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#17131F] px-6 text-[#F3ECE0]">
      <div className="w-full max-w-md rounded-3xl border border-red-400/10 bg-white/[0.04] p-6 text-center">
        <div className="mb-3 text-lg font-semibold">
          Unable to load level
        </div>

        <p className="text-sm text-white/50">
          {message}
        </p>
      </div>
    </main>
  );
}