// components/BottomBar.tsx
import { Home, PartyPopper, Plus, MessageCircle, User } from 'lucide-react';

interface BottomBarProps {
  isHost: boolean;
  onOpenGift?: () => void;
  onPlusClick?: () => void;
  onHomeClick?: () => void;
  onPartyClick?: () => void;
  onMessagesClick?: () => void;
  onProfileClick?: () => void;
}

/**
 * Bottom action bar. Chat input/live stream live in <RoomChat /> directly
 * above this row, so only the share / menu / gift / like actions remain here.
 */
export function BottomBar({ 
  onPlusClick, 
  onHomeClick, 
  onPartyClick, 
  onMessagesClick, 
  onProfileClick 
}: BottomBarProps) {
  return (
    <div className="absolute inset-x-0 bottom-[10px] z-40 flex justify-center px-4">
      {/* Main Pill Container */}
      <div className="relative flex w-full max-w-[400px] items-center justify-between rounded-full border border-orange-500/20 bg-[#0a0a0a]/90 px-6 py-3 shadow-[0_0_30px_rgba(255,140,0,0.1)] backdrop-blur-xl">
        
        {/* Home */}
        <button 
          type="button" 
          onClick={onHomeClick}
          aria-label="Home"
          className="flex h-10 w-10 items-center justify-center text-orange-400 transition-transform active:scale-90"
        >
          <Home className="h-6 w-6 fill-orange-400/20" />
        </button>

        {/* Party Popper */}
        <button 
          type="button" 
          onClick={onPartyClick}
          aria-label="Party"
          className="flex h-10 w-10 items-center justify-center text-white/60 transition-transform active:scale-90 hover:text-white"
        >
          <PartyPopper className="h-6 w-6" />
        </button>

        {/* Center Plus Button - Floats above the bar */}
        <div className="relative -top-6">
          <button
            type="button"
            onClick={onPlusClick}
            aria-label="Create"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ffb347] to-[#ff8c00] shadow-[0_0_20px_rgba(249,115,22,0.5)] transition-transform active:scale-90"
          >
            <Plus className="h-7 w-7 text-black" strokeWidth={3} />
          </button>
        </div>

        {/* Messages */}
        <button 
          type="button" 
          onClick={onMessagesClick}
          aria-label="Messages"
          className="flex h-10 w-10 items-center justify-center text-white/60 transition-transform active:scale-90 hover:text-white"
        >
          <MessageCircle className="h-6 w-6" />
        </button>

        {/* Profile */}
        <button 
          type="button" 
          onClick={onProfileClick}
          aria-label="Profile"
          className="flex h-10 w-10 items-center justify-center text-white/60 transition-transform active:scale-90 hover:text-white"
        >
          <User className="h-6 w-6" />
        </button>

      </div>
    </div>
  );
}