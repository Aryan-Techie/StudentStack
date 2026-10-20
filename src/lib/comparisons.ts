import type { Resource } from "@/lib/resources";

// Hand-picked comparison sets for overlapping offers (PRD §8.9, issue #36).
// New sets are added here as content, not built by users. Slugs come from
// offers.json; a slug with no approved row is skipped, so a set keeps
// rendering if an offer is removed or renamed.
export type ComparisonSet = {
  slug: string;
  name: string;
  description: string;
  resourceSlugs: string[];
};

export const COMPARISON_SETS: ComparisonSet[] = [
  {
    slug: "cloud-credits",
    name: "Cloud credits compared",
    description:
      "Free tiers and student credits from the major cloud platforms, side by side: how much you get, how long it lasts, and what you need to sign up.",
    resourceSlugs: [
      "aws-free-tier",
      "azure-for-students",
      "google-cloud-free-trial",
      "oracle-cloud",
      "ibm-cloud",
      "alibaba-cloud",
      "digitalocean",
      "heroku",
      "vultr",
    ],
  },
  {
    slug: "ai-coding-assistants",
    name: "AI coding assistants compared",
    description:
      "Student plans for AI code editors and coding agents, side by side: what is free, for how long, and how you verify.",
    resourceSlugs: [
      "github-copilot",
      "cursor-pro",
      "openai-codex",
      "kiro-for-students",
      "amp-code",
      "freebuff",
    ],
  },
  {
    slug: "design-tools",
    name: "Design tools compared",
    description:
      "Education plans for UI, graphic, and whiteboard tools, side by side: what the student tier unlocks and how long it lasts.",
    resourceSlugs: [
      "figma",
      "canva",
      "sketch",
      "framer",
      "adobe-creative-cloud",
      "affinity",
      "miro",
      "uxpin",
    ],
  },
];

export function getComparisonSet(slug: string): ComparisonSet | undefined {
  return COMPARISON_SETS.find((set) => set.slug === slug);
}

export function comparisonSetsForResource(resourceSlug: string): ComparisonSet[] {
  return COMPARISON_SETS.filter((set) => set.resourceSlugs.includes(resourceSlug));
}

// Orders resources as listed in the set and drops slugs with no row.
export function orderForSet(set: ComparisonSet, resources: Resource[]): Resource[] {
  const bySlug = new Map(resources.map((r) => [r.slug, r]));
  return set.resourceSlugs.flatMap((slug) => {
    const r = bySlug.get(slug);
    return r ? [r] : [];
  });
}
