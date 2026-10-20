"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BOOKMARK_STATUS_LABELS } from "@/lib/bookmark-status";
import { useBookmarks } from "./bookmarks-provider";
import { StatusPills } from "./status-pills";

// "Save" on every card (issue #33). Signed out: links to /my-list to sign
// in, carrying the resource so it is saved on return. Signed in and not
// saved: one click saves as Interested. Saved: opens the status picker.
export function BookmarkButton({
  resourceId,
  resourceName,
  className,
}: {
  resourceId: number;
  resourceName: string;
  className?: string;
}) {
  const { ready, signedIn, statusOf, setStatus, remove } = useBookmarks();
  const status = statusOf(resourceId);

  if (ready && !signedIn) {
    return (
      <Link
        href={`/my-list?save=${resourceId}`}
        className={className}
        aria-label={`Sign in to save ${resourceName}`}
        title="Save to my list"
      >
        <Bookmark className="size-4" aria-hidden />
      </Link>
    );
  }

  if (!status) {
    return (
      <button
        type="button"
        className={className}
        disabled={!ready}
        onClick={(e) => {
          e.stopPropagation();
          void setStatus(resourceId, "interested");
        }}
        aria-label={`Save ${resourceName}`}
        title="Save to my list"
      >
        <Bookmark className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={className}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${resourceName} saved as ${BOOKMARK_STATUS_LABELS[status]}. Change status`}
          title={`Saved: ${BOOKMARK_STATUS_LABELS[status]}`}
        >
          <BookmarkCheck className="size-4 fill-current" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-xs font-medium text-muted-foreground">Status</p>
        <StatusPills name={resourceName} value={status} onChange={(next) => void setStatus(resourceId, next)} />
        <div className="flex items-center justify-between pt-1 text-xs">
          <button type="button" className="text-muted-foreground underline hover:text-foreground" onClick={() => void remove(resourceId)}>
            Remove
          </button>
          <Link href="/my-list" className="font-medium underline">
            Open my list
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
