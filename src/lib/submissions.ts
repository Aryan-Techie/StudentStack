import type { Resource } from "@/lib/resources";
import { isBlockedIp, METADATA_HOSTNAMES } from "@/lib/ip-ranges";

export const SUBMISSION_COST_TYPES = ["free", "discount", "credits", "trial", "scholarship", "stipend"] as const;

export type SubmissionField =
  | "name"
  | "url"
  | "tagline"
  | "description"
  | "categoryId"
  | "costType"
  | "region"
  | "credit";
export type SubmissionErrors = Partial<Record<SubmissionField, string>>;

export type SubmissionValue = {
  name: string;
  url: string;
  tagline: string | null;
  description: string;
  categoryId: number;
  costType: Resource["costType"];
  region: Resource["region"];
  credit: string | null;
};

const LIMITS = { name: 80, url: 500, tagline: 90, descriptionMin: 20, description: 600, credit: 40 };

// Only http(s) links with a real hostname. Drops the #fragment and a bare
// trailing "/" so the duplicate check sees one spelling per link.
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".")) return null;
  // Sync SSRF guard for IP literals (no DNS available here): reject
  // private/loopback/link-local/reserved ranges outright, e.g.
  // http://169.254.169.254/latest/meta-data/. Plain hostnames get the full
  // DNS-based check server-side at submission time (assertPublicUrl).
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedIp(hostname)) return null;
  if (METADATA_HOSTNAMES.has(hostname.toLowerCase())) return null;
  url.hash = "";
  const text = url.toString();
  return url.pathname === "/" && !url.search ? text.replace(/\/$/, "") : text;
}

// Key for duplicate detection (issue #35): the same offer is often pasted as
// http vs https, with or without "www.", with a #fragment, or with a
// trailing slash. isUrlListed() in src/lib/resources.ts applies the same
// normalization in SQL — keep the two in sync.
export function urlMatchKey(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");
}

export function validateSubmission(
  input: Record<string, string | undefined>,
  categoryIds: number[],
): { ok: true; value: SubmissionValue } | { ok: false; errors: SubmissionErrors } {
  const errors: SubmissionErrors = {};

  const name = (input.name ?? "").trim();
  if (name.length < 2) errors.name = "Add the offer’s name.";
  else if (name.length > LIMITS.name) errors.name = `Keep the name under ${LIMITS.name} characters.`;

  const rawUrl = (input.url ?? "").trim();
  const url = rawUrl.length <= LIMITS.url ? normalizeUrl(rawUrl) : null;
  if (!url) errors.url = "Paste the full link to the offer, starting with https://";

  const tagline = (input.tagline ?? "").trim();
  if (tagline.length > LIMITS.tagline) errors.tagline = `Keep the one-liner under ${LIMITS.tagline} characters.`;

  const description = (input.description ?? "").trim();
  if (description.length < LIMITS.descriptionMin) {
    errors.description = "Say what students get and how to claim it (at least 20 characters).";
  } else if (description.length > LIMITS.description) {
    errors.description = `Keep it under ${LIMITS.description} characters.`;
  }

  const categoryId = Number(input.categoryId);
  if (!Number.isInteger(categoryId) || !categoryIds.includes(categoryId)) errors.categoryId = "Pick a category.";

  const costType = input.costType ?? "";
  const isCostType = (SUBMISSION_COST_TYPES as readonly string[]).includes(costType);
  if (!isCostType) errors.costType = "Pick what kind of offer it is.";

  const region: Resource["region"] = input.region === "IN" ? "IN" : "Global";

  // Public contributor credit (issue #82): plain text only, no links.
  const credit = (input.credit ?? "").replace(/\s+/g, " ").trim();
  if (credit.length > LIMITS.credit) errors.credit = `Keep the credit under ${LIMITS.credit} characters.`;
  else if (/https?:|www\.|[<>]/i.test(credit)) errors.credit = "Use a name, not a link.";

  if (Object.keys(errors).length > 0 || !url || !isCostType) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      url,
      tagline: tagline || null,
      description,
      categoryId,
      costType: costType as Resource["costType"],
      region,
      credit: credit || null,
    },
  };
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "offer";
}
