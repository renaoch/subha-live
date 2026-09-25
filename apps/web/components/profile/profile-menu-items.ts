import {
  GiftIcon,
  TrophyIcon,
  GameIcon,
  StoreIcon,
  InviteIcon,
  HeartIcon,
  ShieldIcon,
  HeadsetIcon,
} from "@/components/icons";

export interface ProfileMenuItem {
  id: string;
  label: string;
  href: string;
  Icon: (props: { className?: string; style?: React.CSSProperties }) => React.JSX.Element;
  /** Optional secondary label, e.g. the "Agency Operations" tag on BD Center. */
  subtitle?: string;
}

export const profileMenuItems: ProfileMenuItem[] = [
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
    subtitle: "Agency Operations",
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
    id: "my-videos",
    label: "My Videos",
    href: "/videos",
    Icon: GiftIcon,
  },
  {
    id: "admin-panel",
    label: "Admin Panel",
    href: "/admin/bd-applications",
    Icon: ShieldIcon,
  },
];
