export type Provider =
  | "google"
  | "facebook"
  | null;

// ─── Public Profile ──────────────────────────────────────────────

export interface PublicProfile {
  id: string;

  /**
   * Stable public User ID.
   * Stored in profiles.public_id.
   */
  public_id: string;

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

  /**
   * Resolved profile role.
   *
   * Normal:
   *   user
   *
   * Agency:
   *   agency_owner
   *   agency_agent
   *
   * The API resolves agency roles from the actual
   * agencies / agency_agents / agency_hosts relationships.
   */
  role: string;

  created_at: string;
}

// ─── Private Profile ────────────────────────────────────────────

export interface PrivateProfile extends PublicProfile {
  coins: number;

  diamonds: number;

  /**
   * True only for platform admins / engineers.
   *
   * This is completely separate from agency ownership.
   */
  is_admin: boolean;

  /**
   * Total number of times other users have visited
   * this profile.
   */
  visitor_count: number;
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

export type RoomMediaType =
  | "video"
  | "audio";

export type RoomStatus =
  | "scheduled"
  | "live"
  | "ended";

export interface LiveRoom {
  id: string;

  title: string;

  hostName: string;

  countryFlag: string;

  viewerCount: number;

  mediaType: RoomMediaType;

  cover: string | null;

  category:
    | "nearby"
    | "popular"
    | "featured"
    | "explore";
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

  senderId:
    | "me"
    | "them";

  text: string;

  timeLabel: string;
}