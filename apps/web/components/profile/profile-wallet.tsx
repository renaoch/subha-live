const numberFormat = new Intl.NumberFormat("en-US");

interface ProfileWalletProps {
  coins: number;
  diamonds: number;
}

export function ProfileWallet({
  coins,
  diamonds,
}: ProfileWalletProps) {
  const items = [
    {
      label: "Coins",
      value: coins,
      color: "#CBA35C",
    },
    {
      label: "Diamonds",
      value: diamonds,
      color: "#D98FA0",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-4 py-3.5"
        >
          <p className="text-xs text-[#9088A0]">
            {item.label}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: item.color,
              }}
              aria-hidden="true"
            />

            {numberFormat.format(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}