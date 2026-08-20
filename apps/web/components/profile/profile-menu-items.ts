import {
  GiftIcon,
  TrophyIcon,
  GameIcon,
  StoreIcon,
  InviteIcon,
  MedalIcon,
  HeartIcon,
  ShieldIcon,
} from "@/components/icons";

export const profileMenuItems = [
  {
    id: "reward",
    label: "Reward",
    href: "/reward",
    Icon: GiftIcon,
  },
  {
    id: "rank",
    label: "Rank",
    href: "/rank",
    Icon: TrophyIcon,
  },
  {
    id: "game",
    label: "Game",
    href: "/game",
    Icon: GameIcon,
  },
  {
    id: "store",
    label: "Store",
    href: "/store",
    Icon: StoreIcon,
  },
  {
    id: "invite",
    label: "Invite",
    href: "/invite",
    Icon: InviteIcon,
  },
  {
    id: "medal",
    label: "Medal",
    href: "/medal",
    Icon: MedalIcon,
  },
  {
    id: "fans-club",
    label: "Fans club",
    href: "/fans-club",
    Icon: HeartIcon,
  },
  {
    id: "auth",
    label: "Auth",
    href: "/auth",
    Icon: ShieldIcon,
  },
] as const;