"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Kept for backwards-compatible links — host task management now lives
// inside the unified "Manage tasks" page alongside user tasks.
export default function AdminHostTaskRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/manage-tasks");
  }, [router]);

  return null;
}
