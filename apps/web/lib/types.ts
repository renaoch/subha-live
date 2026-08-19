export type Provider = "google" | "facebook" | null;

export interface Profile {
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

  coins: number;
  diamonds: number;

  followers: number;
  following: number;

  created_at: string;
}

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