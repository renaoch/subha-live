import { ConnectionsPage } from "@/components/profile/connections-page";

export default function Page({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab =
    searchParams.tab === "following"
      ? "following"
      : "followers";

  return <ConnectionsPage initialTab={tab} />;
}