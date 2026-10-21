// Application-tracker statuses for saved resources (PRD §8.7, issue #33).
// Client-safe: no DB imports, so cards and /my-list can share the labels.
export const BOOKMARK_STATUSES = ["interested", "applied", "got_it", "rejected"] as const;

export type BookmarkStatus = (typeof BOOKMARK_STATUSES)[number];

export const BOOKMARK_STATUS_LABELS: Record<BookmarkStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  got_it: "Got it",
  rejected: "Rejected",
};

export function isBookmarkStatus(value: unknown): value is BookmarkStatus {
  return typeof value === "string" && (BOOKMARK_STATUSES as readonly string[]).includes(value);
}
