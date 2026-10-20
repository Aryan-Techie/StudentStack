"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { removeBookmark, saveBookmark } from "@/app/my-list/actions";
import type { BookmarkStatus } from "@/lib/bookmark-status";

// Client-side bookmark state for the directory and resource pages (issue
// #33). Loads the signed-in student's statuses once from /api/bookmarks and
// applies changes optimistically, rolling back if the Server Action fails.

type BookmarksContextValue = {
  ready: boolean;
  signedIn: boolean;
  statusOf: (resourceId: number) => BookmarkStatus | undefined;
  setStatus: (resourceId: number, status: BookmarkStatus) => Promise<boolean>;
  remove: (resourceId: number) => Promise<boolean>;
};

const BookmarksContext = createContext<BookmarksContextValue>({
  ready: false,
  signedIn: false,
  statusOf: () => undefined,
  setStatus: async () => false,
  remove: async () => false,
});

export function useBookmarks(): BookmarksContextValue {
  return useContext(BookmarksContext);
}

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [statuses, setStatuses] = useState<Record<number, BookmarkStatus>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookmarks", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { signedIn: false, bookmarks: {} }))
      .then((data: { signedIn: boolean; bookmarks: Record<number, BookmarkStatus> }) => {
        if (cancelled) return;
        setSignedIn(data.signedIn);
        setStatuses(data.bookmarks);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(
    async (resourceId: number, next: BookmarkStatus | undefined, run: () => ReturnType<typeof saveBookmark>) => {
      let previous: BookmarkStatus | undefined;
      setStatuses((current) => {
        previous = current[resourceId];
        const copy = { ...current };
        if (next) copy[resourceId] = next;
        else delete copy[resourceId];
        return copy;
      });
      const result = await run().catch(() => ({ ok: false as const, reason: "failed" as const }));
      if (!result.ok) {
        setStatuses((current) => {
          const copy = { ...current };
          if (previous) copy[resourceId] = previous;
          else delete copy[resourceId];
          return copy;
        });
        if (result.reason === "signed_out") setSignedIn(false);
      }
      return result.ok;
    },
    [],
  );

  const value = useMemo<BookmarksContextValue>(
    () => ({
      ready,
      signedIn,
      statusOf: (resourceId) => statuses[resourceId],
      setStatus: (resourceId, status) => apply(resourceId, status, () => saveBookmark(resourceId, status)),
      remove: (resourceId) => apply(resourceId, undefined, () => removeBookmark(resourceId)),
    }),
    [ready, signedIn, statuses, apply],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}
