import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export interface PrivateProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  bio: string | null;
  country: string;
  countryFlag: string;
  level: number;
  vip_level: number;
  svip: boolean;
  is_verified: boolean;
  coins: number;
  diamonds: number;
  followers: number;
  following: number;
  gender: string | null;
  is_admin: boolean;
  role: "user" | "host" | "bd" | "admin"; 
  created_at: string;

}