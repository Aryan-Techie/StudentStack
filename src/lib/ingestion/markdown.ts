// Generic parsers for GitHub-hosted resource lists (issue #83): Markdown
// tables and "### [Name](url)" / "- [Name](url) — note" link lists.

export type MarkdownLink = { text: string; url: string };

const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;

// Image syntax (![alt](src), e.g. shields.io badges) is not a link.
export function firstLink(cell: string): MarkdownLink | null {
  const m = cell.replace(/!\[[^\]]*\]\([^)]*\)/g, "").match(LINK);
  return m ? { text: cleanText(m[1]), url: m[2] } : null;
}

// Strips Markdown link/image/emphasis syntax and badges down to text.
export function cleanText(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`⭐]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

// Every table in the document as rows keyed by (cleaned) header text. Rows
// with fewer cells than headers get "" for the missing ones.
export function parseMarkdownTables(md: string): Record<string, string>[][] {
  const lines = md.split(/\r?\n/);
  const tables: Record<string, string>[][] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith("|") || !SEPARATOR.test(lines[i + 1])) continue;
    const headers = splitRow(lines[i]).map(cleanText);
    const rows: Record<string, string>[] = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const cells = splitRow(lines[j]);
      rows.push(Object.fromEntries(headers.map((h, k) => [h, cells[k] ?? ""])));
    }
    tables.push(rows);
    i = j - 1;
  }
  return tables;
}

export type ListedLink = MarkdownLink & { note: string; section: string | null };

// "### [Name](url)" followed by a paragraph, or "- [Name](url) - note",
// tagged with the nearest "## Section" heading above it.
export function parseLinkList(md: string): ListedLink[] {
  const out: ListedLink[] = [];
  const lines = md.split(/\r?\n/);
  let section: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      section = cleanText(h2[1]);
      continue;
    }
    const heading = line.match(/^#{3,4}\s+(.*)$/);
    if (heading) {
      const link = firstLink(heading[1]);
      if (!link) continue;
      let note = "";
      for (let j = i + 1; j < lines.length && !lines[j].startsWith("#"); j++) {
        if (lines[j].trim()) {
          note = cleanText(lines[j]);
          break;
        }
      }
      out.push({ ...link, note, section });
      continue;
    }
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      const link = firstLink(item[1]);
      if (!link) continue;
      const note = cleanText(item[1].replace(LINK, "")).replace(/^[-–—:]\s*/, "");
      out.push({ ...link, note, section });
    }
  }
  return out;
}
