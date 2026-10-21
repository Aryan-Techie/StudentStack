import { parse as parseYaml } from "yaml";
import { fetchText, stripHtml } from "../rss";
import { cleanText, firstLink, parseLinkList, parseMarkdownTables } from "../markdown";
import type { CandidateFields, IngestionSource } from "../types";

// GitHub-hosted resource lists (issue #83). Each source reads one file
// from raw.githubusercontent.com and uses the GitHub Commits API for
// change detection, so an unchanged list costs one small API call.

type RepoFile = { repo: string; branch: string; path: string };

function rawUrl(f: RepoFile): string {
  return `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${f.path}`;
}

export async function latestCommitSha(f: RepoFile, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "StudentStackBot/1.0" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetchImpl(
      `https://api.github.com/repos/${f.repo}/commits?path=${encodeURIComponent(f.path)}&sha=${f.branch}&per_page=1`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const commits = (await res.json()) as { sha?: string }[];
    return commits[0]?.sha ?? null;
  } catch {
    return null; // no fingerprint = always fetch
  }
}

type Kind = NonNullable<CandidateFields["kind"]>;

function kindFromType(type: string): Kind {
  const t = type.toLowerCase();
  if (t.includes("intern")) return "internship";
  if (t.includes("mentor")) return "mentorship";
  if (t.includes("fellow")) return "fellowship";
  if (t.includes("scholar")) return "scholarship";
  return "program";
}

function hasStipend(value: string): boolean {
  return /^\s*yes/i.test(cleanText(value));
}

// --- deepanshu1422/List-Of-Open-Source-Internships-Programs: one table of
// programs with Name | Stipend | Timeline | Eligibility | ... | Tech Stack.
const DEEPANSHU: RepoFile = { repo: "deepanshu1422/List-Of-Open-Source-Internships-Programs", branch: "master", path: "README.md" };

export function mapProgramTableRow(row: Record<string, string>, source: string): CandidateFields | null {
  const link = firstLink(row["Name"] ?? "");
  if (!link) return null;
  const timeline = cleanText(row["Timeline"] ?? "");
  const eligibility = cleanText(row["Eligibility"] ?? "");
  const focus = cleanText(row["Tech Stack/Focus"] ?? "");
  const paid = hasStipend(row["Stipend"] ?? "");
  const description = [
    `Open-source program${paid ? " with a stipend" : ""}.`,
    timeline && `Timeline: ${timeline}.`,
    eligibility && `Eligibility: ${eligibility}.`,
    focus && focus !== "Various" && `Focus: ${focus}.`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    externalId: `${source}:${link.url}`,
    name: link.text,
    description,
    url: link.url,
    categorySlug: "development-tools",
    tags: ["Open Source"],
    region: "Global",
    costType: paid ? "stipend" : "free",
    kind: kindFromType(row["Type"] ?? "program"),
  };
}

export const deepanshuPrograms: IngestionSource = {
  name: "github:deepanshu1422-oss-programs",
  version: () => latestCommitSha(DEEPANSHU),
  fetchCandidates: async () => parseMarkdownTables(await fetchText(rawUrl(DEEPANSHU))).flat(),
  mapToCandidate: (raw) => mapProgramTableRow(raw as Record<string, string>, "deepanshu1422"),
};

// --- ayush-sleeping/Every-Open-Source-Programs: month-by-month tables with
// approximate registration and deadline months. Month badge rows have no
// link and are skipped. The deadline is approximate, so it becomes the
// recurrence-style note in the description rather than a hard date.
const AYUSH: RepoFile = { repo: "ayush-sleeping/Every-Open-Source-Programs", branch: "main", path: "README.md" };

export function mapMonthlyTableRow(row: Record<string, string>): CandidateFields | null {
  const link = firstLink(row["Name"] ?? "");
  if (!link) return null;
  const type = cleanText(row["Type"] ?? "");
  const timeline = cleanText(row["Timeline"] ?? "");
  // Cells like "Before the deadline" or "-----" carry no date; keep only
  // values that name a month.
  const monthish = (v: string) => (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(v) ? v : "");
  const opens = monthish(cleanText(row["Registration Date Begin (Approximately)"] ?? ""));
  const closes = monthish(cleanText(row["Deadline (Approx.)"] ?? ""));
  const paid = hasStipend(row["Stipend"] ?? "");
  const description = [
    `${type || "Open-source program"}${paid ? " with a stipend" : ""}.`,
    timeline && `Runs ${timeline}.`,
    opens && `Registration usually opens around ${opens}.`,
    closes && `Deadline is usually around ${closes}.`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    externalId: `ayush-sleeping:${link.url}`,
    name: link.text,
    description,
    url: link.url,
    categorySlug: "development-tools",
    tags: ["Open Source"],
    region: "Global",
    costType: paid ? "stipend" : "free",
    kind: kindFromType(type),
  };
}

export const ayushPrograms: IngestionSource = {
  name: "github:ayush-sleeping-oss-programs",
  version: () => latestCommitSha(AYUSH),
  fetchCandidates: async () =>
    parseMarkdownTables(await fetchText(rawUrl(AYUSH)))
      .flat()
      .filter((row) => "Deadline (Approx.)" in row),
  mapToCandidate: (raw) => mapMonthlyTableRow(raw as Record<string, string>),
};

// --- yashisrani/List-of-OpenSource-Programs: structured YAML with org,
// timeline, stipend range, and eligibility.
const YASH: RepoFile = { repo: "yashisrani/List-of-OpenSource-Programs", branch: "main", path: "data/programs.yml" };

type YamlProgram = {
  name?: string;
  short_name?: string;
  url?: string;
  org?: string;
  timeline?: string;
  stipend?: { min?: number; max?: number; currency?: string; note?: string; unpaid?: boolean };
  eligibility?: string;
  tags?: string[];
};

function formatStipend(s: YamlProgram["stipend"]): string | null {
  if (!s || s.unpaid) return null;
  if (s.min && s.max) {
    const sym = s.currency === "USD" ? "$" : s.currency === "INR" ? "₹" : `${s.currency ?? ""} `;
    const fmt = (n: number) => n.toLocaleString("en-US");
    return s.min === s.max ? `${sym}${fmt(s.min)}` : `${sym}${fmt(s.min)}–${fmt(s.max)}`;
  }
  return s.note ?? null;
}

export function mapYamlProgram(p: YamlProgram): CandidateFields | null {
  if (!p?.name || !p.url) return null;
  const amount = formatStipend(p.stipend);
  const description = [
    p.org ? `Open-source program run by ${p.org}.` : "Open-source program.",
    p.timeline && `Timeline: ${p.timeline}.`,
    p.eligibility && `Eligibility: ${p.eligibility}.`,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\.\./g, ".");
  return {
    externalId: `yashisrani:${p.url}`,
    name: p.name,
    tagline: amount ? `Paid program, ${amount}` : null,
    description,
    url: p.url,
    categorySlug: "development-tools",
    tags: ["Open Source", ...(p.tags?.includes("beginner-friendly") ? ["Beginner Friendly"] : [])],
    region: "Global",
    costType: amount ? "stipend" : "free",
    kind: /fellow/i.test(p.name) ? "fellowship" : /mentor/i.test(p.name) ? "mentorship" : "program",
    amount,
    provider: p.org ?? null,
  };
}

export const yashisraniPrograms: IngestionSource = {
  name: "github:yashisrani-oss-programs",
  version: () => latestCommitSha(YASH),
  fetchCandidates: async () => {
    const data = parseYaml(await fetchText(rawUrl(YASH)));
    return Array.isArray(data) ? data : [];
  },
  mapToCandidate: (raw) => mapYamlProgram(raw as YamlProgram),
};

// --- sdhutchins/awesome-edu-perks: US-focused perks as "### [Name](url)"
// entries grouped under "## Category" headings.
const EDU_PERKS: RepoFile = { repo: "sdhutchins/awesome-edu-perks", branch: "main", path: "README.md" };

const EDU_SECTION_CATEGORY: [RegExp, string][] = [
  [/software|productivity/i, "productivity"],
  [/entertainment|music|video|stream/i, "media-and-entertainment"],
  [/food|dining/i, "food-and-dining"],
  [/fitness|health/i, "health-and-wellness"],
  [/travel|transport|finance|bank/i, "travel-and-finance"],
  [/retail|shopping/i, "shopping-and-lifestyle"],
  [/education|learning/i, "learning-and-education"],
];

export const eduPerks: IngestionSource = {
  name: "github:awesome-edu-perks",
  version: () => latestCommitSha(EDU_PERKS),
  fetchCandidates: async () => parseLinkList(await fetchText(rawUrl(EDU_PERKS))).filter((l) => l.note),
  mapToCandidate(raw): CandidateFields | null {
    const item = raw as ReturnType<typeof parseLinkList>[number];
    const category = EDU_SECTION_CATEGORY.find(([re]) => re.test(item.section ?? ""))?.[1] ?? "productivity";
    return {
      externalId: `awesome-edu-perks:${item.url}`,
      name: item.text,
      description: item.note,
      url: item.url,
      categorySlug: category,
      tags: ["US"],
      region: "Global",
      kind: "perk",
    };
  },
};

// --- GitHub Student Developer Pack partner page. Each partner card has an
// anchor id, an "About" line, and one or more offers.
const PACK_URL = "https://education.github.com/pack";

export type PackOffer = { id: string; name: string; about: string; offers: string[] };

export function parsePackPage(html: string): PackOffer[] {
  const out: PackOffer[] = [];
  const cards = html.split(/<div class="pack-offer-card\b/).slice(1);
  for (const card of cards) {
    const head = card.match(/<h3 id="([^"]+)"[^>]*>([\s\S]*?)<\/h3>/);
    if (!head) continue;
    const about = card.match(/<h4 class="f5">About[\s\S]*?<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/);
    const offers = [...card.matchAll(/<h5[^>]*>Offer[\s\S]*?<\/h5>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => stripHtml(m[1]));
    out.push({ id: head[1], name: stripHtml(head[2]), about: about ? stripHtml(about[1]) : "", offers });
  }
  return out;
}

export const githubStudentPack: IngestionSource = {
  name: "github-student-pack",
  fetchCandidates: async () => parsePackPage(await fetchText(PACK_URL)),
  mapToCandidate(raw): CandidateFields | null {
    const p = raw as PackOffer;
    if (!p.name || p.offers.length === 0) return null;
    return {
      externalId: `pack:${p.id}`,
      name: p.name,
      tagline: p.offers[0].length <= 90 ? p.offers[0] : null,
      description: [p.about, ...p.offers].filter(Boolean).join(" "),
      url: `${PACK_URL}#${p.id}`,
      categorySlug: "development-tools",
      tags: ["GitHub Student Pack"],
      region: "Global",
      costType: "free",
      kind: "perk",
    };
  },
};
