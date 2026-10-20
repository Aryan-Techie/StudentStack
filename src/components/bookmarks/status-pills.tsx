"use client";

import { BOOKMARK_STATUSES, BOOKMARK_STATUS_LABELS, type BookmarkStatus } from "@/lib/bookmark-status";

// The four tracker statuses as a single-choice pill group, shared by the
// card popover and /my-list rows.
export function StatusPills({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: BookmarkStatus;
  onChange: (status: BookmarkStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={`Status for ${name}`} className="flex flex-wrap gap-1.5">
      {BOOKMARK_STATUSES.map((status) => {
        const active = status === value;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(status);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {BOOKMARK_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
