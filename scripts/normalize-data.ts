// Reads offers.json (raw studentoffers.co export) and normalizes it into
// rows matching src/db/schema.ts. See PROGRESS.md §4.3 for the judgment
// calls encoded below (category_sub -> tag, cost_type mapping, missing
// claim_url handling, region collapsing).
import { readFileSync } from "node:fs";
import path from "node:path";

export type NormalizedCategory = {
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
};

export type NormalizedResource = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  url: string | null;
  hasStaticClaimUrl: boolean;
  categorySlug: string;
  tags: string[];
  region: "IN" | "Global";
  costType: "free" | "discount" | "stipend" | "scholarship" | "credits" | "trial";
  // Heuristically derived from offer/description/extra_info text by the
  // derive*() helpers below (issue #73). verificationNeeded always resolves
  // (defaults to "none"); creditCardRequired/duration stay undefined when
  // no pattern matches. Admins can still correct these by hand via /admin —
  // scripts/seed.ts only backfills them when the stored value is NULL.
  verificationNeeded?: "none" | "edu_email" | "github_student_pack" | "student_id";
  creditCardRequired?: boolean;
  duration?: "one_time" | "one_year" | "while_student" | "lifetime";
  status: "active" | "expired" | "broken";
};

export type RawOffer = {
  id: number;
  name: string;
  offer: string;
  description: string;
  claim_url: string | null;
  location: string | null;
  tag2: string | null;
  category_main: string;
  category_sub: string;
  slug: string;
  extra_info: string | null;
  tags: string[];
};

const CATEGORY_ICONS: Record<string, string> = {
  "AI & Machine Learning": "🤖",
  "Development Tools": "🛠️",
  "Design & Creative": "🎨",
  Productivity: "⚡",
  "Learning & Education": "📚",
  "Media & Entertainment": "🎬",
  "Shopping & Lifestyle": "🛍️",
  "Cloud & Hosting": "☁️",
  "Travel & Finance": "💳",
  "Security & Privacy": "🔒",
  "Science & Research": "🔬",
  "Food & Dining": "🍔",
  "Student Memberships": "🎓",
  "Health & Wellness": "🩺",
  "Marketing & Growth": "📈",
};

const COST_TYPE_MAP: Record<string, NormalizedResource["costType"]> = {
  Free: "free",
  Discount: "discount",
  Credit: "credits",
  Trial: "trial",
};

function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toRegion(location: string | null): "IN" | "Global" {
  return location === "India" ? "IN" : "Global";
}

function parseExtraInfo(raw: string | null): { notes: string[] } {
  if (!raw) return { notes: [] };
  try {
    const parsed = JSON.parse(raw) as {
      important_notes?: { text: string }[];
      disclaimer?: string;
    };
    const notes = (parsed.important_notes ?? []).map((n) => n.text);
    if (parsed.disclaimer) notes.push(parsed.disclaimer);
    return { notes };
  } catch {
    return { notes: [] };
  }
}

// --- Heuristic field derivation (issue #73) ---------------------------------
// The raw export carries no explicit verification/credit-card/duration
// columns, so these are inferred from the offer tagline, description, and
// extra_info notes. All matchers are case-insensitive; checks run in the
// order listed in the issue so overlapping phrasing resolves deterministically.

export function deriveVerificationNeeded(
  text: string,
): NonNullable<NormalizedResource["verificationNeeded"]> {
  const t = text.toLowerCase();
  if (t.includes("github student") || t.includes("student developer pack")) {
    return "github_student_pack";
  }
  if (
    t.includes(".edu") ||
    t.includes("university email") ||
    t.includes("college email") ||
    t.includes("academic email")
  ) {
    return "edu_email";
  }
  if (
    t.includes("student id") ||
    t.includes("sheerid") ||
    t.includes("unidays") ||
    t.includes("student beans") ||
    t.includes("isic") ||
    t.includes("enrollment") ||
    t.includes("enrolment")
  ) {
    return "student_id";
  }
  return "none";
}

export function deriveCreditCardRequired(text: string): boolean | null {
  const t = text.toLowerCase();
  // Negative signals first: "no credit card required" contains the positive
  // phrasing too, and must resolve to false.
  if (
    t.includes("no credit card") ||
    t.includes("without a credit card") ||
    t.includes("without credit card")
  ) {
    return false;
  }
  if (
    t.includes("credit card required") ||
    t.includes("requires a credit card") ||
    t.includes("require a credit card")
  ) {
    return true;
  }
  return null;
}

export function deriveDuration(
  text: string,
): "one_time" | "one_year" | "while_student" | "lifetime" | null {
  const t = text.toLowerCase();
  if (/\b(1 year|one year|12[-\s]?months?)\b/.test(t)) return "one_year";
  if (
    t.includes("while you are a student") ||
    t.includes("while enrolled") ||
    t.includes("renewable")
  ) {
    return "while_student";
  }
  if (t.includes("lifetime") || t.includes("forever")) return "lifetime";
  if (t.includes("one-time") || t.includes("one time") || t.includes("single use")) {
    return "one_time";
  }
  return null;
}

export function normalizeRawOffers(raw: RawOffer[]): {
  categories: NormalizedCategory[];
  resources: NormalizedResource[];
} {
  const categoryNames = [...new Set(raw.map((o) => o.category_main))].sort();
  const categories: NormalizedCategory[] = categoryNames.map((name, i) => ({
    slug: slugifyCategory(name),
    name,
    icon: CATEGORY_ICONS[name] ?? "📦",
    sortOrder: i,
  }));

  const resources: NormalizedResource[] = raw.map((o) => {
    const { notes } = parseExtraInfo(o.extra_info);
    const description = notes.length
      ? `${o.description}\n\nNote: ${notes.join(" ")}`
      : o.description;

    const tags: string[] = [];
    const seen = new Set<string>();
    for (const t of [...o.tags, o.category_sub]) {
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(t);
    }

    const hasStaticClaimUrl = Boolean(o.claim_url);

    // Signal text for the heuristic classifiers: tagline + description +
    // extra_info notes (issue #73).
    const signalText = [o.offer, o.description, ...notes]
      .filter(Boolean)
      .join("\n");

    return {
      slug: o.slug,
      name: o.name,
      tagline: o.offer || null,
      description,
      url: hasStaticClaimUrl ? o.claim_url : null,
      hasStaticClaimUrl,
      categorySlug: slugifyCategory(o.category_main),
      tags,
      region: toRegion(o.location),
      costType: o.tag2 ? (COST_TYPE_MAP[o.tag2] ?? "free") : "free",
      verificationNeeded: deriveVerificationNeeded(signalText),
      creditCardRequired: deriveCreditCardRequired(signalText) ?? undefined,
      duration: deriveDuration(signalText) ?? undefined,
      status: "active",
    };
  });

  return { categories, resources };
}

export function normalizeOffers(offersJsonPath: string): {
  categories: NormalizedCategory[];
  resources: NormalizedResource[];
} {
  const raw = JSON.parse(readFileSync(offersJsonPath, "utf-8")) as RawOffer[];
  return normalizeRawOffers(raw);
}

if (process.argv[1] && process.argv[1].endsWith("normalize-data.ts")) {
  const offersPath = path.join(process.cwd(), "offers.json");
  const { categories, resources } = normalizeOffers(offersPath);

  console.assert(categories.length > 0, "expected at least one category");
  console.assert(resources.length === 593, `expected 593 resources, got ${resources.length}`);

  const categorySlugs = new Set(categories.map((c) => c.slug));
  for (const r of resources) {
    console.assert(
      categorySlugs.has(r.categorySlug),
      `resource ${r.slug} references unknown category ${r.categorySlug}`,
    );
    console.assert(
      r.hasStaticClaimUrl === (r.url !== null),
      `resource ${r.slug} has inconsistent hasStaticClaimUrl/url`,
    );
  }

  const noClaimUrl = resources.filter((r) => !r.hasStaticClaimUrl).length;
  const missingVerification = resources.filter((r) => !r.verificationNeeded).length;
  console.assert(
    missingVerification === 0,
    `expected verificationNeeded on every resource, ${missingVerification} missing`,
  );
  const derivedStats = {
    verification: Object.fromEntries(
      ["none", "edu_email", "github_student_pack", "student_id"].map((v) => [
        v,
        resources.filter((r) => r.verificationNeeded === v).length,
      ]),
    ),
    creditCard: {
      yes: resources.filter((r) => r.creditCardRequired === true).length,
      no: resources.filter((r) => r.creditCardRequired === false).length,
    },
    duration: Object.fromEntries(
      ["one_time", "one_year", "while_student", "lifetime"].map((d) => [
        d,
        resources.filter((r) => r.duration === d).length,
      ]),
    ),
  };
  console.log(
    `OK: ${categories.length} categories, ${resources.length} resources, ${noClaimUrl} without a static claim URL`,
  );
  console.log(`derived fields: ${JSON.stringify(derivedStats)}`);
}
