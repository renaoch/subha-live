import Link from "next/link";

import { profileMenuItems } from "./profile-menu-items";

export function ProfileMenu() {
  return (
    <nav
      aria-label="Profile menu"
      className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-2"
    >
      <ul className="grid grid-cols-4 gap-y-4">
        {profileMenuItems.map(
          ({ id, label, href, Icon }) => (
            <li key={id}>
              <Link
                href={href}
                className="flex flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-colors hover:bg-[#2A2238]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2A2238]">
                  <Icon className="h-5 w-5 text-[#CBA35C]" />
                </span>

                <span className="text-[11px] text-[#D9D2E0]">
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