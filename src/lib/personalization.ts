import type { Resource } from "@/lib/resources";

// Personalization signals (PRD §8.8, issue #34). Branch and year are a
// ranking boost for the "For you" sort, never a filter: every resource
// stays visible.

export const BRANCHES = [
  ["CSE", "Computer Science / IT"],
  ["ECE", "Electronics / Electrical"],
  ["Mechanical", "Mechanical / Aerospace"],
  ["Civil", "Civil / Architecture"],
  ["Design", "Design"],
  ["Other", "Other"],
] as const;

export type Branch = (typeof BRANCHES)[number][0];

export const YEARS = [1, 2, 3, 4, 5] as const; // 5 = "5th year or later"

export type ProfileSignals = {
  branch: string | null;
  year: number | null;
};

export function isBranch(value: unknown): value is Branch {
  return typeof value === "string" && BRANCHES.some(([b]) => b === value);
}

// Branch tagging is derived instead of stored: resources carry tags (which
// include offers.json's category_sub, e.g. "PCB & Electronics Design") plus
// a category, and a handful of flagship engineering tools are only
// recognizable by name. Keeping it in code means no backfill when the
// mapping changes.
const CATEGORY_BRANCHES: Record<string, Branch[]> = {
  "development-tools": ["CSE"],
  "cloud-and-hosting": ["CSE"],
  "ai-and-machine-learning": ["CSE"],
  "security-and-privacy": ["CSE"],
  "design-and-creative": ["Design"],
};

const TAG_BRANCHES: Record<string, Branch[]> = {
  developer: ["CSE"],
  api: ["CSE"],
  "open source": ["CSE"],
  devops: ["CSE"],
  databases: ["CSE"],
  "code editors": ["CSE"],
  "ai code editors": ["CSE"],
  "git clients": ["CSE"],
  "testing & qa": ["CSE"],
  "machine learning": ["CSE"],
  cybersecurity: ["CSE"],
  "pcb & electronics design": ["ECE"],
  "scientific software": ["ECE", "Mechanical"],
  "3d & animation": ["Mechanical", "Design"],
  architecture: ["Civil"],
  "ui/ux tools": ["Design"],
  "graphic design tools": ["Design"],
  "video editing": ["Design"],
};

// Lowercase substrings of resource names.
const NAME_BRANCHES: [string, Branch[]][] = [
  ["matlab", ["ECE", "Mechanical"]],
  ["altium", ["ECE"]],
  ["cst studio", ["ECE"]],
  ["labview", ["ECE"]],
  ["multisim", ["ECE"]],
  ["proteus", ["ECE"]],
  ["kicad", ["ECE"]],
  ["solidworks", ["Mechanical"]],
  ["solid edge", ["Mechanical"]],
  ["ansys", ["Mechanical", "Civil"]],
  ["altair", ["Mechanical"]],
  ["ptc creo", ["Mechanical"]],
  ["fusion 360", ["Mechanical"]],
  ["shapr3d", ["Mechanical"]],
  ["hexagon", ["Mechanical"]],
  ["autodesk", ["Mechanical", "Civil"]],
  ["autocad", ["Mechanical", "Civil"]],
  ["revit", ["Civil"]],
  ["rhino", ["Civil", "Design"]],
  ["lumion", ["Civil"]],
  ["enscape", ["Civil"]],
  ["chaos", ["Civil", "Design"]],
];

export function resourceBranches(r: Pick<Resource, "name" | "tags" | "categorySlug">): Set<Branch> {
  const out = new Set<Branch>(CATEGORY_BRANCHES[r.categorySlug] ?? []);
  for (const tag of r.tags) {
    for (const b of TAG_BRANCHES[tag.toLowerCase()] ?? []) out.add(b);
  }
  const name = r.name.toLowerCase();
  for (const [needle, branches] of NAME_BRANCHES) {
    if (name.includes(needle)) for (const b of branches) out.add(b);
  }
  return out;
}

// Higher = more relevant. Branch match is the main signal. Year only
// matters for opportunities with a minimum year: reachable ones get a small
// boost, ones the student can't apply to yet a small penalty.
export function personalizationScore(
  r: Pick<Resource, "name" | "tags" | "categorySlug" | "eligibility">,
  profile: ProfileSignals,
): number {
  let score = 0;
  if (profile.branch && profile.branch !== "Other" && resourceBranches(r).has(profile.branch as Branch)) {
    score += 2;
  }
  const minYear = r.eligibility?.minYear;
  if (profile.year && minYear) score += profile.year >= minYear ? 1 : -1;
  return score;
}

export function hasSignals(profile: ProfileSignals | null | undefined): profile is ProfileSignals {
  return Boolean(profile && (profile.branch || profile.year));
}

// Stable: ties keep the incoming (recommended) order.
export function sortForYou<T extends Pick<Resource, "name" | "tags" | "categorySlug" | "eligibility">>(
  list: T[],
  profile: ProfileSignals,
): T[] {
  const scores = new Map(list.map((r) => [r, personalizationScore(r, profile)]));
  return [...list].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
}
