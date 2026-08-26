// File: apps/web/store/ui-store.ts
//
// Cross-page, non-persisted UI state. Anything here is transient by design
// (resets on reload). Use this for things multiple components need to read
// or write without threading props/context — e.g. the "Go Live" modal being
// triggerable from the bottom nav AND the home page, or remembering which
// live-rooms tab the user was on when they navigate away and back.

import { create } from "zustand";

interface UIState {
  liveTab: "all" | "nearby" | "popular" | "featured" | "explore";
  setLiveTab: (tab: UIState["liveTab"]) => void;

  createRoomOpen: boolean;
  setCreateRoomOpen: (open: boolean) => void;

  unreadChats: number;
  setUnreadChats: (n: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  liveTab: "all",
  setLiveTab: (liveTab) => set({ liveTab }),

  createRoomOpen: false,
  setCreateRoomOpen: (createRoomOpen) => set({ createRoomOpen }),

  unreadChats: 0,
  setUnreadChats: (unreadChats) => set({ unreadChats }),
}));
