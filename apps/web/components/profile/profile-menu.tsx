import Link from "next/link";

import { profileMenuItems } from "./profile-menu-items";

export function ProfileMenu() {
  return (
    <nav
      aria-label="Profile menu"
      className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4"
    >
      <ul className="grid grid-cols-4 gap-x-2 gap-y-6">
        {profileMenuItems.map(
          ({ id, label, href, Icon }) => (
            <li key={id}>
              <Link
                href={href}
                className="group flex min-h-[88px] flex-col items-center justify-start gap-2 rounded-xl px-1 py-1 text-center transition-colors hover:bg-[#2A2238]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2A2238] transition-colors group-hover:bg-[#332A45]">
                  <Icon className="h-6 w-6 text-[#CBA35C]" />
                </span>

                <span className="max-w-[76px] text-[11px] font-medium leading-4 text-[#D9D2E0]">
                  {label}
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}