// Normalizes student_resources.json (the resources.tensorboy.com export,
// issue #79) into the same rows as offers.json, and drops anything
// offers.json already lists. Like offers.json, the raw file is not
// committed (see .gitignore); `pnpm db:seed` uses it when it's present.
import type { NormalizedResource } from "./normalize-data";

export type RawStudentResource = {
  "Program Name": string;
  "Program Value"?: string;
  Tags?: string[];
  Description?: string;
  "Program Company Icon"?: string;
  "Apply Link"?: string;
};

export type RawStudentResources = Partial<
  Record<
    "tools_and_software" | "certifications_and_courses" | "scholarships_and_fellowships" | "internships_and_mentorship",
    RawStudentResource[]
  >
>;

type Bucket = keyof RawStudentResources;
type Kind = NonNullable<NormalizedResource["kind"]>;

// Job boards, loans, and generic portals are out of scope: StudentStack is
// not a job board (PRODUCT.md non-goals).
const EXCLUDED = /\b(internshala|letsintern|naukri|stucred|studentpeeps|linkedin career)\b/i;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Words that describe the student deal rather than the product, so
// "Cursor Pro Student" and "Cursor" compare equal. Only used for perks:
// for scholarships and programs those words are part of the name.
const DEAL_WORDS = new Set([
  "student", "students", "education", "educational", "edu", "academic", "campus", "classrooms",
  "plan", "discount", "license", "edition", "pack", "program", "platform", "offer",
  "free", "tier", "plus", "pro", "premium", "credit", "credits", "for", "with", "the",
]);

export function coreName(name: string): string {
  return normalizeName(name)
    .split(" ")
    .filter((w) => !DEAL_WORDS.has(w))
    .join(" ");
}

function hostAndPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "resource"
  );
}

function kindFor(bucket: Bucket, r: RawStudentResource): Kind {
  const text = `${r["Program Name"]} ${(r.Tags ?? []).join(" ")} ${r["Program Value"] ?? ""}`.toLowerCase();
  if (bucket === "scholarships_and_fellowships") return /fellowship/.test(text) && !/scholarship/.test(text) ? "fellowship" : "scholarship";
  if (bucket === "internships_and_mentorship") {
    if (/mentor/.test(text)) return "mentorship";
    if (/intern|research|stipend|instep/.test(text)) return "internship";
    return "program";
  }
  if (bucket === "certifications_and_courses") return /ambassador|bootcamp|scholarship|nanodegree|program/.test(text) ? "program" : "perk";
  return "perk";
}

const TOOL_CATEGORY: [RegExp, string][] = [
  [/\bai\b|chatbot|machine learning/, "ai-and-machine-learning"],
  [/cloud|hosting|infrastructure|server/, "cloud-and-hosting"],
  [/design|creative|video|photo|cad/, "design-and-creative"],
  [/develop|coding|code|version control|git/, "development-tools"],
  [/shopping|discount/, "shopping-and-lifestyle"],
];

function categoryFor(bucket: Bucket, r: RawStudentResource): string {
  if (bucket !== "tools_and_software") return "learning-and-education";
  const text = `${r["Program Name"]} ${(r.Tags ?? []).join(" ")}`.toLowerCase();
  return TOOL_CATEGORY.find(([re]) => re.test(text))?.[1] ?? "productivity";
}

function costTypeFor(kind: Kind, value: string): NormalizedResource["costType"] {
  if (kind === "scholarship" || kind === "fellowship") return "scholarship";
  if (kind === "internship" || /stipend|\/month|per month/i.test(value)) return "stipend";
  if (/credit/i.test(value)) return "credits";
  if (/% off|discount/i.test(value)) return "discount";
  return "free";
}

// India-specific when the text says so (government schemes, Indian
// institutions, ₹ amounts); everything else is treated as worldwide.
function isIndiaOnly(r: RawStudentResource): boolean {
  const text = `${r["Program Name"]} ${r.Description ?? ""} ${(r.Tags ?? []).join(" ")} ${r["Program Value"] ?? ""}`;
  return /₹|\b(india|indian|aicte|ugc|iit|nptel|swayam|government of india|ministry)\b/i.test(text);
}

export type StudentResourcesResult = {
  resources: NormalizedResource[];
  duplicates: { name: string; matched: string }[];
  excluded: string[];
};

// Dedup against `existing` (offers.json rows) by normalized name or by the
// claim link's host + path. Host alone isn't enough: google.com hosts many
// unrelated offers.
export function normalizeStudentResources(raw: RawStudentResources, existing: NormalizedResource[]): StudentResourcesResult {
  const byName = new Map(existing.map((r) => [normalizeName(r.name), r]));
  const byCore = new Map(existing.flatMap((r) => (coreName(r.name) ? [[coreName(r.name), r] as const] : [])));
  const byLink = new Map(existing.flatMap((r) => (r.url ? [[hostAndPath(r.url), r] as const] : [])));
  const usedSlugs = new Set(existing.map((r) => r.slug));
  const out: StudentResourcesResult = { resources: [], duplicates: [], excluded: [] };

  for (const bucket of Object.keys(raw) as Bucket[]) {
    for (const r of raw[bucket] ?? []) {
      const name = r["Program Name"]?.trim();
      if (!name) continue;
      if (EXCLUDED.test(name)) {
        out.excluded.push(name);
        continue;
      }
      const link = hostAndPath(r["Apply Link"]);
      const isPerkBucket = bucket === "tools_and_software" || bucket === "certifications_and_courses";
      const core = coreName(name);
      const match =
        byName.get(normalizeName(name)) ??
        (isPerkBucket && core ? byCore.get(core) : undefined) ??
        (link ? byLink.get(link) : undefined);
      if (match) {
        out.duplicates.push({ name, matched: match.name });
        continue;
      }

      let slug = slugify(name);
      for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(name)}-${i}`;
      usedSlugs.add(slug);

      const value = r["Program Value"]?.trim() ?? "";
      const kind = kindFor(bucket, r);
      const india = isIndiaOnly(r);
      const url = r["Apply Link"]?.trim() || null;
      const row: NormalizedResource = {
        slug,
        name,
        tagline: value || null,
        description: r.Description?.trim() || value || name,
        url,
        hasStaticClaimUrl: Boolean(url),
        categorySlug: categoryFor(bucket, r),
        tags: [...new Set((r.Tags ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 6),
        region: india ? "IN" : "Global",
        regions: india ? ["IN"] : [],
        regionLocked: india,
        costType: costTypeFor(kind, value),
        verificationNeeded: undefined,
        status: "active",
        kind,
        amount: kind === "perk" ? null : value || null,
      };
      out.resources.push(row);
      byName.set(normalizeName(name), row);
      if (isPerkBucket && core) byCore.set(core, row);
      if (link) byLink.set(link, row);
    }
  }
  return out;
}
