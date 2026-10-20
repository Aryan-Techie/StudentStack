"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { StatusPills } from "@/components/bookmarks/status-pills";
import { BOOKMARK_STATUSES, BOOKMARK_STATUS_LABELS, type BookmarkStatus } from "@/lib/bookmark-status";
import styles from "@/components/home/brand.module.css";
import { removeBookmark, saveBookmark } from "./actions";

export type MyListItem = {
  resourceId: number;
  slug: string;
  name: string;
  tagline: string | null;
  url: string | null;
  hasStaticClaimUrl: boolean;
  deadline: number | null;
  resourceStatus: "active" | "expired" | "broken";
  status: BookmarkStatus;
  savedAt: number;
};

type Change = { resourceId: number; status: BookmarkStatus | null };

const deadlineFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Saved resources grouped by tracker status (issue #33). Status changes and
// removals apply optimistically; the Server Action revalidates /my-list so
// the server copy catches up.
export function MyListClient({ items }: { items: MyListItem[] }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyChange] = useOptimistic(items, (current: MyListItem[], change: Change) =>
    change.status === null
      ? current.filter((i) => i.resourceId !== change.resourceId)
      : current.map((i) => (i.resourceId === change.resourceId ? { ...i, status: change.status as BookmarkStatus } : i)),
  );

  const change = (resourceId: number, status: BookmarkStatus | null) => {
    startTransition(async () => {
      applyChange({ resourceId, status });
      if (status === null) await removeBookmark(resourceId);
      else await saveBookmark(resourceId, status);
    });
  };

  if (optimistic.length === 0) {
    return (
      <div className={styles.notice}>
        <p>Nothing saved yet.</p>
        <p className={styles.hint}>
          Use the bookmark icon on any card in the <Link href="/directory" className="underline">directory</Link>, or on
          an offer’s own page, to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-16" aria-busy={pending || undefined}>
      {BOOKMARK_STATUSES.map((status) => {
        const group = optimistic.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`group-${status}`}>
            <h2 id={`group-${status}`} className={styles.sectionTitle}>
              {BOOKMARK_STATUS_LABELS[status]} <span className="text-muted-foreground">({group.length})</span>
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {group.map((item) => (
                <li key={item.resourceId} className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/r/${item.slug}`} className="font-semibold hover:underline">
                      {item.name}
                    </Link>
                    {item.tagline && <p className="text-sm text-muted-foreground">{item.tagline}</p>}
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {item.deadline && <span>Deadline {deadlineFormat.format(item.deadline)}</span>}
                      {item.resourceStatus !== "active" && <span>Offer {item.resourceStatus}</span>}
                      {item.hasStaticClaimUrl && item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline">
                          View offer ↗
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPills name={item.name} value={item.status} onChange={(next) => change(item.resourceId, next)} />
                    <button
                      type="button"
                      onClick={() => change(item.resourceId, null)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                      aria-label={`Remove ${item.name} from my list`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
