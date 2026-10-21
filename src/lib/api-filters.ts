import { RESOURCE_KIND_VALUES } from "@/db/schema";
import { resourceKind, worksInIndia } from "@/lib/directory-filters";
import type { Resource, ResourceKind } from "@/lib/resources";

// Query filters for the public GET /api/resources (issue #82). Parsing is
// pure so the route can 400 on bad input; matchesApiFilters is the
// in-memory twin of the SQL in getResourcesPaginated (used for the mock
// fallback and tests) — keep them in sync.
export type ApiFilters = {
  kind?: ResourceKind[];
  category?: string;
  region?: "IN" | "Global";
  deadlineBefore?: Date;
};

const CATEGORY_SLUG = /^[a-z0-9-]{1,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

export function parseApiFilters(params: URLSearchParams): { ok: true; filters: ApiFilters } | { ok: false; error: string } {
  const filters: ApiFilters = {};

  const kindRaw = params.get("kind");
  if (kindRaw !== null) {
    const kinds = kindRaw.split(",").map((k) => k.trim()).filter(Boolean);
    const valid = RESOURCE_KIND_VALUES as readonly string[];
    if (kinds.length === 0 || kinds.some((k) => !valid.includes(k))) {
      return { ok: false, error: `Invalid 'kind' query parameter: expected one or more of ${valid.join(", ")}` };
    }
    filters.kind = kinds as ResourceKind[];
  }

  const category = params.get("category");
  if (category !== null) {
    if (!CATEGORY_SLUG.test(category)) {
      return { ok: false, error: "Invalid 'category' query parameter: expected a category slug" };
    }
    filters.category = category;
  }

  const region = params.get("region");
  if (region !== null) {
    if (region !== "IN" && region !== "Global") {
      return { ok: false, error: "Invalid 'region' query parameter: expected IN or Global" };
    }
    filters.region = region;
  }

  const deadline = params.get("deadline_before");
  if (deadline !== null) {
    const date = ISO_DATE.test(deadline) ? new Date(deadline) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return { ok: false, error: "Invalid 'deadline_before' query parameter: expected an ISO date like 2026-12-31" };
    }
    filters.deadlineBefore = date;
  }

  return { ok: true, filters };
}

// deadline_before returns active resources still open now and closing on
// or before the date. region=IN means "works in India" and region=Global
// means not locked to any geography, same as the directory facets.
export function matchesApiFilters(r: Resource, f: ApiFilters, nowMs: number = Date.now()): boolean {
  if (f.kind && !f.kind.includes(resourceKind(r))) return false;
  if (f.category && r.categorySlug !== f.category) return false;
  if (f.region === "IN" && !worksInIndia(r)) return false;
  if (f.region === "Global" && r.regionLocked) return false;
  if (f.deadlineBefore) {
    if (r.status !== "active" || r.deadline === null) return false;
    if (r.deadline < nowMs || r.deadline > f.deadlineBefore.getTime()) return false;
  }
  return true;
}
