import { ConnectionsPage } from "@/components/profile/connections-page";

export default function Page({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab =
    searchParams.tab === "following"
      ? "following"
      : searchParams.tab === "friends"
        ? "friends"
        : "followers";

  return <ConnectionsPage initialTab={tab} />;
}