export type Provider = "google" | "facebook" | null;

// ─── Public Profile ──────────────────────────────────────────────
// Information that can safely be exposed on another user's profile.

export interface PublicProfile {
  id: string;

  name: string | null;
  handle: string | null;
  avatar: string | null;
  bio: string | null;

  country: string | null;
  country_flag: string | null;
  gender: string | null;

  level: number;
  vip_level: number;
  svip: boolean;
  is_verified: boolean;

  followers: number;
  following: number;

  role: "user" | "host" | "bd" | "admin"; // ✅ ADD THIS

  created_at: string;
}

// ─── Private Profile ────────────────────────────────────────────
// The authenticated user's own profile.

export interface PrivateProfile extends PublicProfile {
  coins: number;
  diamonds: number;
}

// ─── Profile API responses ─────────────────────────────────────

export interface PrivateProfileResponse {
  status: "ok";
  user: PrivateProfile;
}

export interface PublicProfileResponse {
  status: "ok";
  user: PublicProfile;
}

// ─── Live Rooms ─────────────────────────────────────────────────

export type RoomMediaType = "video" | "audio";

export type RoomStatus = "scheduled" | "live" | "ended";

export interface LiveRoom {
  id: string;
  title: string;
  hostName: string;
  countryFlag: string;
  viewerCount: number;
  mediaType: RoomMediaType;
  cover: string | null;
  category: "nearby" | "popular" | "featured" | "explore";
}

// ─── Chat ───────────────────────────────────────────────────────

export interface ChatPreview {
  id: string;
  userName: string;
  lastMessage: string;
  timeLabel: string;
  unreadCount: number;
  isTyping?: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: "me" | "them";
  text: string;
  timeLabel: string;
}