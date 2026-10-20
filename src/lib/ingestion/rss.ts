// Dependency-free RSS 2.0 parsing and deadline extraction shared by the
// feed sources (issue #83). Feeds are small (tens to a few hundred items),
// so regex over <item> blocks is enough and avoids an XML dependency.

export type RssItem = {
  title: string;
  link: string;
  guid: string;
  description: string;
  categories: string[];
  pubDate: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function unwrapCdata(value: string): string {
  return value.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
}

export function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? unwrapCdata(m[1]) : null;
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const [, block] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = stripHtml(tag(block, "title") ?? "");
    const link = decodeEntities((tag(block, "link") ?? "").trim());
    if (!title || !link) continue;
    items.push({
      title,
      link,
      guid: decodeEntities((tag(block, "guid") ?? link).trim()),
      description: tag(block, "description") ?? "",
      categories: [...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((m) =>
        stripHtml(unwrapCdata(m[1])),
      ),
      pubDate: tag(block, "pubDate")?.trim() ?? null,
    });
  }
  return items;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}

// Builds a UTC date and rejects impossible ones (e.g. 30 February).
function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day, 23, 59, 59));
  return d.getUTCMonth() === month && d.getUTCDate() === day ? d : null;
}

const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

// Pulls a deadline out of free text. Prefers a date right after a
// "deadline"/"closes"/"apply by" cue; otherwise takes the first date found.
// Understands "15 March 2026", "March 15, 2026", "2026-03-15", and
// day-first "15/03/2026". Dates are end-of-day UTC.
export function extractDeadline(text: string): Date | null {
  const plain = stripHtml(text);
  const cue = plain.match(/(?:deadline|closes?|closing|apply by|last date|due)\s*(?:date)?\s*(?:is|on)?\s*[:\-–]?\s*(.{0,60})/i);
  return (cue && firstDate(cue[1])) || firstDate(plain);
}

function firstDate(text: string): Date | null {
  const candidates: { index: number; date: Date | null }[] = [];
  const push = (m: RegExpMatchArray | null, build: (m: RegExpMatchArray) => Date | null) => {
    if (m && m.index !== undefined) candidates.push({ index: m.index, date: build(m) });
  };
  push(text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/), (m) => utcDate(+m[1], +m[2] - 1, +m[3]));
  push(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\.?,?\\s+(\\d{4})\\b`, "i").exec(text), (m) =>
    utcDate(+m[3], monthIndex(m[2]), +m[1]),
  );
  push(new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i").exec(text), (m) =>
    utcDate(+m[3], monthIndex(m[1]), +m[2]),
  );
  push(text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/), (m) => utcDate(+m[3], +m[2] - 1, +m[1]));
  const valid = candidates.filter((c) => c.date).sort((a, b) => a.index - b.index);
  return valid[0]?.date ?? null;
}

export async function fetchText(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "StudentStackBot/1.0 (+https://studentstack.vercel.app)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.text();
}
