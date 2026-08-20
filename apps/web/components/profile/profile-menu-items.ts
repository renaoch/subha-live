import {
  GiftIcon,
  TrophyIcon,
  GameIcon,
  StoreIcon,
  InviteIcon,
  MedalIcon,
  HeartIcon,
  ShieldIcon,
  HeadsetIcon,
} from "@/components/icons";

export const profileMenuItems = [
  {
    id: "level",
    label: "Level",
    href: "/level",
    Icon: TrophyIcon,
  },
  {
    id: "store",
    label: "Store",
    href: "/store",
    Icon: StoreIcon,
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/tasks",
    Icon: GameIcon,
  },
  {
    id: "family",
    label: "Family",
    href: "/family",
    Icon: InviteIcon,
  },
  {
    id: "vip",
    label: "VIP",
    href: "/vip",
    Icon: ShieldIcon,
  },
  {
    id: "cp",
    label: "CP",
    href: "/cp",
    Icon: HeartIcon,
  },
  {
    id: "bd-center",
    label: "BD Center",
    href: "/bd-center",
    Icon: HeadsetIcon,
  },
  {
    id: "agency-center",
    label: "Agency Center",
    href: "/agency-center",
    Icon: StoreIcon,
  },
  {
    id: "my-post",
    label: "My Post",
    href: "/posts",
    Icon: GiftIcon,
  },
  {
    id: "offline-recharge",
    label: "Offline Recharge",
    href: "/offline-recharge",
    Icon: GameIcon,
  },
  {
    id: "host-center",
    label: "Host Center",
    href: "/host-center",
    Icon: HeadsetIcon,
  },
  {
    id: "my-videos",
    label: "My Videos",
    href: "/videos",
    Icon: GiftIcon,
  },
] as const;