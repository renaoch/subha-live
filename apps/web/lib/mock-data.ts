// TEMPORARY: your API has no GET /rooms (discovery) or chat/message
// endpoints yet. This keeps the UI fully working and typed so it's a
// drop-in swap once those routes exist — replace the two functions
// below with real `apiFetch` calls and delete this file.

import type { ChatMessage, ChatPreview, LiveRoom } from "@/lib/types";

const GRADIENTS = [
  "from-fuchsia-500 to-purple-600",
  "from-purple-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-violet-500 to-fuchsia-600",
  "from-indigo-500 to-purple-700",
  "from-rose-500 to-pink-600",
];

export function gradientFor(seed: string) {
  const index =
    seed.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) %
    GRADIENTS.length;
  return GRADIENTS[index];
}

export const MOCK_ROOMS: LiveRoom[] = [
  { id: "r1", title: "Morning vibes ☕", hostName: "Amelia", countryFlag: "🇬🇧", viewerCount: 109, mediaType: "video", cover: null, category: "nearby" },
  { id: "r2", title: "Road trip live", hostName: "Sofia", countryFlag: "🇺🇸", viewerCount: 96, mediaType: "video", cover: null, category: "nearby" },
  { id: "r3", title: "Chai & chat", hostName: "Priya", countryFlag: "🇮🇳", viewerCount: 214, mediaType: "video", cover: null, category: "nearby" },
  { id: "r4", title: "Getting ready", hostName: "Layla", countryFlag: "🇸🇦", viewerCount: 58, mediaType: "audio", cover: null, category: "popular" },
  { id: "r5", title: "Desert sunset", hostName: "Fatima", countryFlag: "🇪🇬", viewerCount: 133, mediaType: "audio", cover: null, category: "popular" },
  { id: "r6", title: "Wedding prep", hostName: "Ananya", countryFlag: "🇮🇳", viewerCount: 87, mediaType: "video", cover: null, category: "featured" },
];

export const MOCK_CHATS: ChatPreview[] = [
  { id: "c1", userName: "Floyd Miles", lastMessage: "That's awesome! Ever tried Thai cuisine?", timeLabel: "9:01 AM", unreadCount: 0 },
  { id: "c2", userName: "Dianne Russell", lastMessage: "hi", timeLabel: "16 mins", unreadCount: 4 },
  { id: "c3", userName: "Cody Fisher", lastMessage: "Typing…", timeLabel: "16 mins", unreadCount: 2, isTyping: true },
  { id: "c4", userName: "Jane Cooper", lastMessage: "how are you", timeLabel: "16 mins", unreadCount: 0 },
];

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", chatId: "c1", senderId: "them", text: "Hey! 👋 I really liked your profile. You enjoy cooking too? 😊", timeLabel: "Today" },
  { id: "m2", chatId: "c1", senderId: "me", text: "Hey Luna Rae! Yes, I try new recipes every week. Creating dishes is my joy.", timeLabel: "9:01 AM" },
  { id: "m3", chatId: "c1", senderId: "them", text: "That's awesome! Ever tried Thai cuisine?", timeLabel: "9:02 AM" },
];