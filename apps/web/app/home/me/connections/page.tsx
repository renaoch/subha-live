import { ConnectionsPage } from "@/components/profile/connections-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab =
    params.tab === "following"
      ? "following"
      : params.tab === "friends"
        ? "friends"
        : "followers";

  return <ConnectionsPage initialTab={tab} />;
}