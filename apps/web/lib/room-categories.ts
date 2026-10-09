// Category chips shown on home-feed live cards.
// The id list MUST match ROOM_CATEGORIES in apps/api/src/modules/rooms/room.service.ts
// (and the rooms_category_check constraint) — the API normalises anything else to 'chat'.

import {
  Gamepad2,
  MessageCircle,
  MessageCircleHeart,
  Music,
  Star,
  type LucideIcon,
} from 'lucide-react';

export type RoomCategoryId = 'chat' | 'music' | 'party' | 'talent' | 'gaming';

export interface RoomCategoryMeta {
  id: RoomCategoryId;
  label: string;
  Icon: LucideIcon;
  /** Tailwind classes for the chip on a card (bg + border + text). */
  chip: string;
  /** Tailwind classes for the icon inside the chip. */
  icon: string;
}

export const ROOM_CATEGORIES: RoomCategoryMeta[] = [
  {
    id: 'chat',
    label: 'Chat',
    Icon: MessageCircle,
    chip: 'border-violet-400/70 bg-violet-600/30 text-white',
    icon: 'text-violet-300',
  },
  {
    id: 'music',
    label: 'Music',
    Icon: Music,
    chip: 'border-rose-400/70 bg-rose-600/25 text-white',
    icon: 'text-rose-300',
  },
  {
    id: 'party',
    label: 'Party',
    Icon: MessageCircleHeart,
    chip: 'border-fuchsia-400/70 bg-fuchsia-600/30 text-white',
    icon: 'text-fuchsia-300',
  },
  {
    id: 'talent',
    label: 'Talent',
    Icon: Star,
    chip: 'border-amber-400/70 bg-amber-600/25 text-white',
    icon: 'fill-amber-300 text-amber-300',
  },
  {
    id: 'gaming',
    label: 'Gaming',
    Icon: Gamepad2,
    chip: 'border-cyan-400/70 bg-cyan-600/25 text-white',
    icon: 'text-cyan-300',
  },
];

export const DEFAULT_ROOM_CATEGORY = ROOM_CATEGORIES[0]!;

export function getRoomCategory(id: string | null | undefined): RoomCategoryMeta {
  const key = (id ?? '').toLowerCase();
  return ROOM_CATEGORIES.find((c) => c.id === key) ?? DEFAULT_ROOM_CATEGORY;
}

export const MAX_TAGLINE_LENGTH = 60;