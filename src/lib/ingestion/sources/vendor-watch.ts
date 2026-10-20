import { createHash } from "node:crypto";
import { decodeEntities, fetchText, stripHtml } from "../rss";
import type { CandidateFields, IngestionSource } from "../types";

// Watches the official student pages of major cloud and tool vendors
// (issue #40). These pages have no feed, and offers on them change rarely
// but matter a lot (a credit amount drops, a plan is renamed). Each page is
// its own source: its fingerprint is a hash of the page's offer lines
// (sentences that mention money, credits, plans, or durations), so cosmetic
// page changes don't trigger a review but "$100" becoming "$200" does.
// When the fingerprint changes, one candidate is queued next to the listed
// resource so an admin can update it.

export type WatchedPage = { slug: string; name: string; url: string };

// Not watched: Oracle Cloud, Canva, and Autodesk answer automated requests
// with 403, and JetBrains renders its offer client-side (no text to hash).
export const WATCHED_PAGES: WatchedPage[] = [
  { slug: "aws-free-tier", name: "AWS Free Tier", url: "https://aws.amazon.com/free/" },
  { slug: "azure-for-students", name: "Microsoft Azure Students", url: "https://azure.microsoft.com/en-us/free/students" },
  { slug: "google-cloud-free-trial", name: "Google Cloud Free Trial", url: "https://cloud.google.com/free/" },
  { slug: "figma", name: "Figma", url: "https://www.figma.com/education/" },
  { slug: "adobe-creative-cloud", name: "Adobe Creative Cloud Pro", url: "https://www.adobe.com/education/students/creativecloud.html" },
  { slug: "microsoft-365", name: "Microsoft 365", url: "https://www.microsoft.com/en-us/education/products/office" },
];

const OFFER_LINE = /[$₹€£]\s?\d|\b\d+\s?(?:%|credits?|months?|years?|days?|gb|tb)\b|\bfree\b|\bplan\b|\bdiscount\b|\btrial\b/i;

// Visible text of the page, split into sentences, keeping only the ones
// that describe the offer. Scripts and styles are dropped first.
// Per-request noise that must never reach the fingerprint: trace and
// request ids, long hex or base64 tokens, timestamps.
const VOLATILE = /trace id|request id|\b[0-9a-f]{16,}\b|\b[A-Za-z0-9+/_-]{32,}\b|\d{1,2}:\d{2}(:\d{2})?/i;

export function offerLines(html: string): string[] {
  const body = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|li|h\d|div|section|td|span|a|button)>/gi, " \u241E ");
  // Decode twice: some pages double-encode (&amp;nbsp;).
  const text = decodeEntities(stripHtml(body));
  const seen = new Set<string>();
  const lines: string[] = [];
  // Block ends were marked with U+241E (a visible symbol, so whitespace
  // collapsing keeps it) before the tags were stripped; split on those and
  // on sentence ends.
  for (const raw of text.split(/\s*\u241E\s*|(?<=[.!?])\s+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 12 || line.length > 240 || /[<>{}]/.test(line) || VOLATILE.test(line)) continue;
    if (!OFFER_LINE.test(line) || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

export function fingerprint(lines: string[]): string {
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 32);
}

export function watchCandidate(page: WatchedPage, lines: string[], version: string): CandidateFields {
  const shown = lines.slice(0, 8).join(" ");
  return {
    externalId: `${page.url}#${version}`,
    name: page.name,
    description: `The official student page changed. Check whether the listing needs an update. Offer lines on the page now: ${shown}`.slice(0, 1000),
    url: page.url,
    updateOf: page.slug,
  };
}

export function watchSource(page: WatchedPage, fetchImpl: typeof fetch = fetch): IngestionSource {
  // version() and fetchCandidates() run back to back in one cron run, so
  // the page is fetched once and shared.
  let pending: Promise<string[]> | null = null;
  const lines = () => (pending ??= fetchText(page.url, fetchImpl).then(offerLines));
  return {
    name: `watch:${page.slug}`,
    baselineFirstRun: true,
    version: async () => {
      const found = await lines();
      return found.length ? fingerprint(found) : null;
    },
    fetchCandidates: async () => {
      const found = await lines();
      return found.length ? [{ lines: found, version: fingerprint(found) }] : [];
    },
    mapToCandidate: (raw) => {
      const item = raw as { lines: string[]; version: string };
      return watchCandidate(page, item.lines, item.version);
    },
  };
}

export function vendorWatchSources(fetchImpl: typeof fetch = fetch): IngestionSource[] {
  return WATCHED_PAGES.map((page) => watchSource(page, fetchImpl));
}
