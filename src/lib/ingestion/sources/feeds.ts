import { extractDeadline, fetchText, parseRssItems, stripHtml, type RssItem } from "../rss";
import type { CandidateFields, IngestionSource } from "../types";

// RSS sources (issue #83). Opportunity Desk is handled separately (#104).

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// Scholars4Dev: international scholarships for students from developing
// countries; the deadline is usually stated in the post body.
export const scholars4dev: IngestionSource = {
  name: "scholars4dev",
  fetchCandidates: async () => parseRssItems(await fetchText("https://www.scholars4dev.com/feed/")),
  mapToCandidate(raw): CandidateFields | null {
    const item = raw as RssItem;
    const description = stripHtml(item.description);
    if (!description) return null;
    return {
      externalId: item.guid,
      name: item.title,
      description: truncate(description, 600),
      url: item.link,
      categorySlug: "learning-and-education",
      tags: ["Scholarship", "International", ...item.categories.slice(0, 2)],
      region: "Global",
      costType: "scholarship",
      kind: "scholarship",
      deadline: extractDeadline(item.description),
    };
  },
};

// Brabble: India-centric aggregator of student contests. Only hackathons
// and coding contests are kept; case studies and quizzes are out of scope.
// Each item's pubDate is when registration closes.
const BRABBLE_KEEP = new Set(["HACKATHON", "CODING", "CONTEST"]);

export const brabble: IngestionSource = {
  name: "brabble",
  fetchCandidates: async () => parseRssItems(await fetchText("https://brabble.ai/rss/all.xml")),
  mapToCandidate(raw): CandidateFields | null {
    const item = raw as RssItem;
    if (!item.categories.some((c) => BRABBLE_KEEP.has(c.toUpperCase()))) return null;
    const text = stripHtml(item.description);
    const platform = text.match(/via ([A-Za-z0-9 .]+?)(?: -|$)/)?.[1]?.trim() ?? null;
    const closes = item.pubDate ? new Date(item.pubDate) : null;
    return {
      externalId: item.guid,
      name: item.title,
      description: truncate(`${text} Listed on Brabble (brabble.ai).`, 600),
      url: item.link,
      categorySlug: "development-tools",
      tags: ["Hackathon"],
      region: "IN",
      costType: "free",
      kind: "program",
      provider: platform,
      deadline: closes && !Number.isNaN(closes.getTime()) ? closes : null,
    };
  },
};
