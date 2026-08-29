// components/BottomBar.tsx
import { Link2, Mail, Menu, Gift, ThumbsUp } from 'lucide-react';

interface BottomBarProps {
  isHost: boolean;
  onOpenGift?: () => void;
}

export function BottomBar({ isHost, onOpenGift }: BottomBarProps) {
  const items = [
    { icon: <Link2 className="h-[15px] w-[15px]" strokeWidth={1.7} />, label: 'Share link' },
    { icon: <Mail className="h-[15px] w-[15px]" strokeWidth={1.7} />, label: 'Messages' },
    { icon: <Menu className="h-[16px] w-[16px]" strokeWidth={1.7} />, label: 'Menu' },
    ...(!isHost
      ? [{ icon: <Gift className="h-[15px] w-[15px]" strokeWidth={1.7} />, label: 'Gift', onClick: onOpenGift }]
      : []),
  ];

  return (
    <div className="absolute inset-x-0 bottom-[10px] z-40 flex items-center gap-[5px] px-[14px]">
      <div className="flex h-[29px] min-w-0 flex-1 items-center rounded-full border border-white/10 bg-black/45 px-[10px] text-[13px] text-white/45 backdrop-blur-xl">
        Say something...
      </div>

      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.label}
          onClick={item.onClick}
          className="flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/45 backdrop-blur-xl"
        >
          {item.icon}
        </button>
      ))}

      <button
        type="button"
        aria-label="Like"
        className="flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full bg-white text-black"
      >
        <ThumbsUp className="h-[14px] w-[14px]" strokeWidth={1.6} />
      </button>
    </div>
  );
}