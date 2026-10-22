import { describe, it, expect } from "vitest";
import {
  CLOSING_SOON_DAYS,
  CRITICAL_DAYS,
  URGENT_DAYS,
  formatDeadline,
  isClosingSoon,
  isPastDeadline,
  partitionDeadlines,
  relativeDeadline,
  urgencyTier,
} from "./deadlines";
import { buildIcsFeed, buildRssFeed, FEED_CACHE_CONTROL } from "./deadline-feeds";
import type { Resource } from "./resources";

const NOW = new Date("2026-10-08T12:00:00Z").getTime();
const DAY = 86_400_000;

function makeResource(deadline: number | null): Resource {
  return {
    id: 1,
    slug: "sample",
    name: "Sample",
    tagline: null,
    description: "A sample resource.",
    url: "https://example.com",
    hasStaticClaimUrl: true,
    categoryId: 1,
    categorySlug: "development-tools",
    categoryName: "Development Tools",
    categoryIcon: "dev",
    tags: [],
    region: "Global",
    regions: [],
    regionLocked: false,
    costType: "free",
    verificationNeeded: null,
    creditCardRequired: null,
    duration: null,
    status: "active",
    lastVerifiedAt: null,
    deadline,
  };
}

describe("isPastDeadline", () => {
  it("treats a deadline at or before now as past", () => {
    expect(isPastDeadline(NOW - DAY, NOW)).toBe(true);
    expect(isPastDeadline(NOW, NOW)).toBe(true);
  });

  it("treats a future deadline as not past", () => {
    expect(isPastDeadline(NOW + DAY, NOW)).toBe(false);
  });
});

describe("isClosingSoon", () => {
  it("is true for deadlines within the closing-soon window", () => {
    expect(isClosingSoon(NOW + DAY, NOW)).toBe(true);
    expect(isClosingSoon(NOW + CLOSING_SOON_DAYS * DAY, NOW)).toBe(true);
  });

  it("is false for deadlines beyond the window", () => {
    expect(isClosingSoon(NOW + (CLOSING_SOON_DAYS + 1) * DAY, NOW)).toBe(false);
  });

  it("is false for past deadlines", () => {
    expect(isClosingSoon(NOW - DAY, NOW)).toBe(false);
  });
});

describe("partitionDeadlines", () => {
  it("splits resources into closing-soon, upcoming, and past buckets", () => {
    const resources = [
      makeResource(NOW + 60 * DAY),
      makeResource(null),
      makeResource(NOW + 3 * DAY),
      makeResource(NOW - 5 * DAY),
      makeResource(NOW + 30 * DAY),
      makeResource(NOW - DAY),
      makeResource(NOW + DAY),
    ];
    const { closingSoon, upcoming, past } = partitionDeadlines(resources, NOW);
    expect(closingSoon.map((r) => r.deadline)).toEqual([NOW + DAY, NOW + 3 * DAY]);
    expect(upcoming.map((r) => r.deadline)).toEqual([NOW + 30 * DAY, NOW + 60 * DAY]);
    expect(past.map((r) => r.deadline)).toEqual([NOW - 5 * DAY, NOW - DAY]);
  });

  it("ignores resources without a deadline", () => {
    const { closingSoon, upcoming, past } = partitionDeadlines([makeResource(null)], NOW);
    expect(closingSoon).toEqual([]);
    expect(upcoming).toEqual([]);
    expect(past).toEqual([]);
  });
});

describe("formatDeadline", () => {
  it("formats as a short date", () => {
    expect(formatDeadline(new Date("2026-12-25T00:00:00Z").getTime())).toBe("Dec 25, 2026");
  });

  it("prints the UTC date, even when it's already the next day in IST (issue #118)", () => {
    // 23:59 UTC on Oct 20 is 05:29 IST on Oct 21; the feeds call it Oct 20.
    expect(formatDeadline(new Date("2026-10-20T23:59:59Z").getTime())).toBe("Oct 20, 2026");
    // 18:30 UTC is IST midnight: still Oct 20 in UTC.
    expect(formatDeadline(new Date("2026-10-20T18:30:00Z").getTime())).toBe("Oct 20, 2026");
  });
});

const HOUR = 3_600_000;

describe("relativeDeadline", () => {
  it("describes future deadlines in days", () => {
    expect(relativeDeadline(NOW + 5 * DAY, NOW)).toBe("in 5 days");
    expect(relativeDeadline(NOW + DAY, NOW)).toBe("tomorrow");
  });

  it("describes past deadlines as closed", () => {
    expect(relativeDeadline(NOW - 3 * DAY, NOW)).toBe("closed 3 days ago");
    expect(relativeDeadline(NOW - DAY, NOW)).toBe("closed yesterday");
    expect(relativeDeadline(NOW - (2 * DAY - 1), NOW)).toBe("closed yesterday");
  });
});

// Issue #118: a deadline that passed within the last day rounded to 0 days
// and read "today" under "Past deadlines".
describe("relativeDeadline boundaries (issue #118)", () => {
  it("never calls a passed deadline 'today'", () => {
    for (const elapsed of [0, 1, HOUR / 2, 3 * HOUR, 11 * HOUR, 12 * HOUR, 23 * HOUR, DAY - 1]) {
      const label = relativeDeadline(NOW - elapsed, NOW);
      expect(label).toMatch(/^closed /);
      expect(label).not.toMatch(/today|in 0/);
    }
  });

  it("reads 'closed just now' at the exact deadline and within the first hour", () => {
    expect(relativeDeadline(NOW, NOW)).toBe("closed just now");
    expect(relativeDeadline(NOW - (HOUR - 1), NOW)).toBe("closed just now");
  });

  it("counts hours for the rest of the first day", () => {
    expect(relativeDeadline(NOW - HOUR, NOW)).toBe("closed 1 hour ago");
    expect(relativeDeadline(NOW - 3 * HOUR, NOW)).toBe("closed 3 hours ago");
    expect(relativeDeadline(NOW - (DAY - 1), NOW)).toBe("closed 23 hours ago");
  });

  it("keeps the open-deadline wording just before the deadline", () => {
    expect(relativeDeadline(NOW + 1, NOW)).toBe("today");
    expect(relativeDeadline(NOW + 3 * HOUR, NOW)).toBe("today");
  });

  it("agrees with isPastDeadline at the boundary", () => {
    expect(isPastDeadline(NOW, NOW)).toBe(true);
    expect(relativeDeadline(NOW, NOW)).toMatch(/^closed /);
    expect(isPastDeadline(NOW + 1, NOW)).toBe(false);
    expect(relativeDeadline(NOW + 1, NOW)).not.toMatch(/^closed /);
  });

  it("labels a curated 12:00 UTC deadline the same across IST and UTC midnight", () => {
    const deadline = new Date("2026-10-20T12:00:00Z").getTime();
    // 00:30 IST on Oct 21 (still Oct 20 in UTC).
    expect(relativeDeadline(deadline, new Date("2026-10-20T19:00:00Z").getTime())).toBe(
      "closed 7 hours ago",
    );
    // 00:30 UTC on Oct 21 (06:00 IST): the reported "· today" case.
    expect(relativeDeadline(deadline, new Date("2026-10-21T00:30:00Z").getTime())).toBe(
      "closed 12 hours ago",
    );
    // A full day later in either zone.
    expect(relativeDeadline(deadline, new Date("2026-10-21T12:00:00Z").getTime())).toBe(
      "closed yesterday",
    );
  });
});

describe("urgencyTier (issue #80)", () => {
  it("marks past deadlines as past", () => {
    expect(urgencyTier(NOW - DAY, NOW)).toBe("past");
    expect(urgencyTier(NOW, NOW)).toBe("past");
  });

  it("marks deadlines within 3 days as critical", () => {
    expect(urgencyTier(NOW + DAY, NOW)).toBe("critical");
    expect(urgencyTier(NOW + CRITICAL_DAYS * DAY, NOW)).toBe("critical");
  });

  it("marks deadlines within 7 days as urgent", () => {
    expect(urgencyTier(NOW + (CRITICAL_DAYS + 1) * DAY, NOW)).toBe("urgent");
    expect(urgencyTier(NOW + URGENT_DAYS * DAY, NOW)).toBe("urgent");
  });

  it("marks deadlines within 14 days as closing-soon", () => {
    expect(urgencyTier(NOW + (URGENT_DAYS + 1) * DAY, NOW)).toBe("closing-soon");
    expect(urgencyTier(NOW + CLOSING_SOON_DAYS * DAY, NOW)).toBe("closing-soon");
  });

  it("marks anything further out as upcoming", () => {
    expect(urgencyTier(NOW + (CLOSING_SOON_DAYS + 1) * DAY, NOW)).toBe("upcoming");
    expect(urgencyTier(NOW + 90 * DAY, NOW)).toBe("upcoming");
  });
});

function makeFeedResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 7,
    slug: "sample-scholarship",
    name: "Sample Scholarship",
    tagline: "Full tuition for one year",
    description: "A sample scholarship.",
    url: "https://example.com/claim",
    hasStaticClaimUrl: true,
    categoryId: 1,
    categorySlug: "development-tools",
    categoryName: "Development Tools",
    categoryIcon: "dev",
    tags: [],
    region: "Global",
    regions: [],
    regionLocked: false,
    costType: "scholarship",
    verificationNeeded: null,
    creditCardRequired: null,
    duration: null,
    status: "active",
    lastVerifiedAt: null,
    deadline: NOW + 5 * DAY,
    amount: "$5,000",
    provider: "Example Foundation",
    recurrence: "Feb",
    ...overrides,
  };
}

const FEED_ORIGIN = "https://example.org";

// Real iCalendar parsers unfold content lines before interpreting them;
// unfold here too so content assertions aren't tripped by line folding.
function unfoldIcs(body: string): string {
  return body.replace(/\r\n /g, "");
}

describe("buildIcsFeed (issue #80)", () => {
  it("emits a valid VCALENDAR with one VEVENT per deadline", () => {
    const body = buildIcsFeed(
      [makeFeedResource(), makeFeedResource({ id: 8, deadline: NOW + 10 * DAY })],
      { origin: FEED_ORIGIN, nowMs: NOW },
    );
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("VERSION:2.0");
    expect(body).toContain("END:VCALENDAR");
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(body).toContain("UID:deadline-7@studentstack");
  });

  it("includes SUMMARY, all-day DTSTART, URL, and a -P1D VALARM", () => {
    const body = unfoldIcs(
      buildIcsFeed([makeFeedResource({ deadline: NOW + 5 * DAY })], {
        origin: FEED_ORIGIN,
        nowMs: NOW,
      }),
    );
    expect(body).toContain("SUMMARY:[StudentStack] Sample Scholarship deadline");
    // All-day event on the deadline date (2026-10-13).
    expect(body).toContain("DTSTART;VALUE=DATE:20261013");
    expect(body).toContain("URL:https://example.com/claim");
    expect(body).toContain("BEGIN:VALARM");
    expect(body).toContain("TRIGGER:-P1D");
    expect(body).toContain("ACTION:DISPLAY");
  });

  it("packs tagline, amount, and claim link into DESCRIPTION", () => {
    const body = unfoldIcs(buildIcsFeed([makeFeedResource()], { origin: FEED_ORIGIN, nowMs: NOW }));
    // DESCRIPTION may fold across lines (>75 chars), so check the unfolded body.
    expect(body).toContain("Full tuition for one year");
    expect(body).toContain("Value: $5\\,000");
    expect(body).toContain("Provider: Example Foundation");
    expect(body).toContain("https://example.com/claim");
  });

  it("folds content lines longer than 75 octets per RFC 5545", () => {
    const body = buildIcsFeed([makeFeedResource()], { origin: FEED_ORIGIN, nowMs: NOW });
    const longLines = body.split("\r\n").filter((l) => l.length > 75);
    expect(longLines).toHaveLength(0);
  });

  it("falls back to the deadlines page URL when the resource has no claim URL", () => {
    const body = unfoldIcs(
      buildIcsFeed([makeFeedResource({ url: null })], {
        origin: FEED_ORIGIN,
        nowMs: NOW,
      }),
    );
    expect(body).toContain(`URL:${FEED_ORIGIN}/deadlines`);
  });

  it("orders events soonest-first and skips resources without deadlines", () => {
    const body = buildIcsFeed(
      [
        makeFeedResource({ id: 1, deadline: NOW + 20 * DAY }),
        makeFeedResource({ id: 2, deadline: null }),
        makeFeedResource({ id: 3, deadline: NOW + 2 * DAY }),
      ],
      { origin: FEED_ORIGIN, nowMs: NOW },
    );
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(body.indexOf("UID:deadline-3@studentstack")).toBeLessThan(
      body.indexOf("UID:deadline-1@studentstack"),
    );
  });

  it("escapes ICS special characters in text fields", () => {
    const body = buildIcsFeed(
      [makeFeedResource({ name: "Grant; A,B\\C", tagline: "Line1\nLine2" })],
      { origin: FEED_ORIGIN, nowMs: NOW },
    );
    expect(body).toContain("SUMMARY:[StudentStack] Grant\\; A\\,B\\\\C deadline");
    expect(body).toContain("Line1\\nLine2");
  });
});

describe("buildRssFeed (issue #80)", () => {
  it("emits valid RSS 2.0 with channel metadata", () => {
    const body = buildRssFeed([makeFeedResource()], { origin: FEED_ORIGIN, nowMs: NOW });
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<rss version="2.0">');
    expect(body).toContain("<title>StudentStack Deadlines</title>");
    expect(body).toContain(`<link>${FEED_ORIGIN}/deadlines</link>`);
  });

  it("includes only upcoming deadlines, soonest first", () => {
    const body = buildRssFeed(
      [
        makeFeedResource({ id: 1, deadline: NOW + 20 * DAY }),
        makeFeedResource({ id: 2, deadline: NOW - DAY }),
        makeFeedResource({ id: 3, deadline: NOW + 2 * DAY }),
      ],
      { origin: FEED_ORIGIN, nowMs: NOW },
    );
    expect(body.match(/<item>/g)).toHaveLength(2);
    expect(body).not.toContain("studentstack-deadline-2");
    expect(body.indexOf("studentstack-deadline-3")).toBeLessThan(
      body.indexOf("studentstack-deadline-1"),
    );
  });

  it("carries deadline date, amount, and claim URL in each item", () => {
    const body = buildRssFeed([makeFeedResource()], { origin: FEED_ORIGIN, nowMs: NOW });
    expect(body).toContain("<link>https://example.com/claim</link>");
    expect(body).toContain("Value: $5,000");
    expect(body).toContain("Provider: Example Foundation");
    expect(body).toContain("<pubDate>");
  });

  it("escapes XML entities", () => {
    const body = buildRssFeed(
      [makeFeedResource({ name: "Grant <A> & B", tagline: 'Say "hi" <loud>' })],
      { origin: FEED_ORIGIN, nowMs: NOW },
    );
    expect(body).toContain("Grant &lt;A&gt; &amp; B");
    expect(body).toContain("Say &quot;hi&quot; &lt;loud&gt;");
  });
});

describe("feed cache headers (issue #80)", () => {
  it("uses a 1-hour public cache with stale-while-revalidate", () => {
    expect(FEED_CACHE_CONTROL).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  });
});
