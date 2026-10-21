// First real ingestion source: Opportunity Desk RSS feed (issue #83, §1).
// Scholarships, fellowships, grants and contests, with deadlines extracted
// from the item text via regex.
import type { CandidateFields, IngestionSource, RawCandidate } from "../types";

export const OPPORTUNITY_DESK_FEED_URL = "https://opportunitydesk.org/feed/";

export type OpportunityDeskItem = {
  title: string;
  link?: string;
  guid?: string;
  description?: string;
  pubDate?: string;
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function toISODate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

const KEYWORDS = String.raw`(?:deadline|apply\s+by|closing\s+date|closes?(?:\s+on)?|last\s+date)`;

const YMD = new RegExp(KEYWORDS + String.raw`\s*[:\-–]?\s*(\d{4})-(\d{2})-(\d{2})`, "i");
const DMY = new RegExp(
  KEYWORDS + String.raw`\s*[:\-–]?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})`,
  "i",
);
const MDY = new RegExp(
  KEYWORDS + String.raw`\s*[:\-–]?\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})`,
  "i",
);
const SLASH_DMY = new RegExp(
  KEYWORDS + String.raw`\s*[:\-–]?\s*(\d{1,2})/(\d{1,2})/(\d{4})`,
  "i",
);

/** Extract an ISO deadline (YYYY-MM-DD) from free text, or null when none/invalid. */
export function extractDeadline(text: string): string | null {
  const s = String(text ?? "");
  let m = YMD.exec(s);
  if (m) return toISODate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = DMY.exec(s);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return toISODate(Number(m[3]), month, Number(m[1]));
  }
  m = MDY.exec(s);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return toISODate(Number(m[3]), month, Number(m[2]));
  }
  m = SLASH_DMY.exec(s);
  if (m) return toISODate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function field(itemXml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(itemXml);
  return m ? stripHtml(m[1]) || undefined : undefined;
}

/** Parse RSS <item> blocks without extra dependencies. */
export function parseRssItems(xml: string): OpportunityDeskItem[] {
  const items: OpportunityDeskItem[] = [];
  for (const m of String(xml ?? "").matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const itemXml = m[0];
    const title = field(itemXml, "title");
    if (!title) continue; // unmappable without a title
    items.push({
      title,
      link: field(itemXml, "link"),
      guid: field(itemXml, "guid"),
      description: field(itemXml, "description"),
      pubDate: field(itemXml, "pubDate"),
    });
  }
  return items;
}

function truncate(text: string, max: number): string {
  const s = text.trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "\u2026" : s;
}

export function mapOpportunityDeskItem(raw: RawCandidate): CandidateFields | null {
  const item = raw as Partial<OpportunityDeskItem>;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (!title) return null;
  const description = truncate(stripHtml(item.description ?? ""), 600);
  const isoDeadline = extractDeadline(`${title}\n${item.description ?? ""}`);
  return {
    externalId: item.guid || item.link || undefined,
    name: title,
    description: description || title,
    url: item.link || undefined,
    deadline: isoDeadline ? new Date(`${isoDeadline}T00:00:00.000Z`) : null,
  };
}

export const opportunityDeskSource: IngestionSource = {
  name: "opportunity-desk",
  async fetchCandidates(): Promise<RawCandidate[]> {
    const res = await fetch(OPPORTUNITY_DESK_FEED_URL, {
      headers: { "User-Agent": "StudentStack-ingestion/1.0" },
    });
    if (!res.ok) throw new Error(`Opportunity Desk feed returned ${res.status}`);
    return parseRssItems(await res.text());
  },
  mapToCandidate: mapOpportunityDeskItem,
};
