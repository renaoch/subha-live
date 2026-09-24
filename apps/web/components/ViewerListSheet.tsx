// components/ViewerListSheet.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { usersApi } from "@/lib/api/users";

interface ViewerEntry {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
}

interface ViewerListSheetProps {
  /** Real connected viewer userIds, from the room's live media state. */
  viewerIds: string[];
  onClose: () => void;
  /** Tapping a viewer row opens their profile popup in place. */
  onOpenProfile?: (userId: string) => void;
}

/**
 * Resolves each connected viewer's userId to a profile (name/handle/avatar)
 * via the users API and lists them in a bottom sheet. The media layer only
 * tracks who is connected by id — this component is what turns that into a
 * human-readable list, with no invented names or placeholder data.
 */
export function ViewerListSheet({ viewerIds, onClose, onOpenProfile }: ViewerListSheetProps) {
  const [profiles, setProfiles] = useState<Record<string, ViewerEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const missing = viewerIds.filter((id) => !profiles[id]);

      if (missing.length === 0) {
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const user = await usersApi.getById(id);
            return [
              id,
              {
                id,
                name: user.name || "Viewer",
                handle: user.handle ?? null,
                avatar: user.avatar ?? null,
              },
            ] as const;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;

      setProfiles((prev) => {
        const next = { ...prev };
        for (const entry of results) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIds.join(",")]);

  const list = viewerIds.map((id) => profiles[id]).filter(Boolean) as ViewerEntry[];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-4 pb-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="stage-card relative w-full max-w-[390px] overflow-hidden rounded-[28px] animate-in fade-in slide-in-from-bottom-6 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition hover:bg-white/[0.06] hover:text-ink"
          aria-label="Close viewer list"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 px-5 pb-4 pt-4">
          <Users className="h-4 w-4 text-accent-hot" />
          <p className="text-[13px] font-bold tracking-tight text-ink">
            {viewerIds.length} watching
          </p>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto px-3 pb-5">
          {loading && list.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-accent-hot" />
            </div>
          ) : viewerIds.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-faint">
              No one else is watching yet.
            </p>
          ) : (
            <div className="space-y-1">
              {list.map((viewer) => (
                <button
                  type="button"
                  key={viewer.id}
                  onClick={() => onOpenProfile?.(viewer.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/[0.04] active:scale-[0.99]"
                >
                  <Avatar name={viewer.name} src={viewer.avatar ?? undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {viewer.name}
                    </p>
                    {viewer.handle && (
                      <p className="truncate text-[11px] text-ink-faint">@{viewer.handle}</p>
                    )}
                  </div>
                </button>
              ))}
              {loading && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-accent-hot" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}