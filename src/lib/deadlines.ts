import type { Resource } from "./resources";

// A deadline this close (in days) gets the visually distinct "closing
// soon" treatment on /deadlines (issue #32 acceptance criteria).
export const CLOSING_SOON_DAYS = 14;

// Urgency tiers for /deadlines card coloring (issue #80, inspired by
// Brabble.ai): ≤3 days critical, ≤7 days urgent, ≤14 days closing soon,
// anything further out upcoming.
export const CRITICAL_DAYS = 3;
export const URGENT_DAYS = 7;

export type UrgencyTier = "critical" | "urgent" | "closing-soon" | "upcoming" | "past";

export function urgencyTier(deadlineMs: number, nowMs: number = Date.now()): UrgencyTier {
  if (isPastDeadline(deadlineMs, nowMs)) return "past";
  const daysLeft = (deadlineMs - nowMs) / DAY_MS;
  if (daysLeft <= CRITICAL_DAYS) return "critical";
  if (daysLeft <= URGENT_DAYS) return "urgent";
  if (daysLeft <= CLOSING_SOON_DAYS) return "closing-soon";
  return "upcoming";
}

const DAY_MS = 86_400_000;

export function isPastDeadline(deadlineMs: number, nowMs: number = Date.now()): boolean {
  return deadlineMs <= nowMs;
}

export function isClosingSoon(deadlineMs: number, nowMs: number = Date.now()): boolean {
  return deadlineMs > nowMs && deadlineMs - nowMs <= CLOSING_SOON_DAYS * DAY_MS;
}

export type DeadlineBuckets = {
  closingSoon: Resource[];
  upcoming: Resource[];
  past: Resource[];
};

// Splits deadline-bearing resources into the /deadlines page sections,
// each sorted soonest-first. Resources without a deadline are ignored.
export function partitionDeadlines(
  resources: Resource[],
  nowMs: number = Date.now(),
): DeadlineBuckets {
  const buckets: DeadlineBuckets = { closingSoon: [], upcoming: [], past: [] };
  for (const resource of resources) {
    if (resource.deadline === null) continue;
    if (isPastDeadline(resource.deadline, nowMs)) buckets.past.push(resource);
    else if (isClosingSoon(resource.deadline, nowMs)) buckets.closingSoon.push(resource);
    else buckets.upcoming.push(resource);
  }
  const byDeadline = (a: Resource, b: Resource) =>
    (a.deadline as number) - (b.deadline as number);
  buckets.closingSoon.sort(byDeadline);
  buckets.upcoming.sort(byDeadline);
  buckets.past.sort(byDeadline);
  return buckets;
}

// Pinned to UTC: deadlines are stored as UTC instants (curated ones at
// 12:00 UTC, ingested ones at end-of-day UTC), the .ics/.rss feeds use the
// UTC date, and the card renders on the server and again on the client, so
// the machine's local zone must not shift the printed day (issue #118).
const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDeadline(deadlineMs: number): string {
  return DATE_FORMAT.format(new Date(deadlineMs));
}

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const HOUR_MS = 3_600_000;

// "in 5 days" / "tomorrow" / "today" for open deadlines; "closed 3 hours
// ago" / "closed yesterday" / "closed 4 days ago" once passed. Uses elapsed
// time, not calendar days, so the label is the same in every time zone, and
// a passed deadline never rounds to "today" (issue #118).
export function relativeDeadline(deadlineMs: number, nowMs: number = Date.now()): string {
  if (!isPastDeadline(deadlineMs, nowMs)) {
    return RELATIVE_FORMAT.format(Math.round((deadlineMs - nowMs) / DAY_MS), "day");
  }
  const elapsed = nowMs - deadlineMs;
  if (elapsed < HOUR_MS) return "closed just now";
  if (elapsed < DAY_MS) return `closed ${RELATIVE_FORMAT.format(-Math.floor(elapsed / HOUR_MS), "hour")}`;
  return `closed ${RELATIVE_FORMAT.format(-Math.floor(elapsed / DAY_MS), "day")}`;
}
