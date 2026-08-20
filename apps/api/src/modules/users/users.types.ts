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

  created_at: string;
}

export interface PrivateProfile extends PublicProfile {
  coins: number;
  diamonds: number;
}

export interface PrivateProfileResponse {
  status: "ok";
  user: PrivateProfile;
}

export interface PublicProfileResponse {
  status: "ok";
  user: PublicProfile;
}