import type { Category } from "@/lib/resources";
import type { ComparisonSet } from "@/lib/comparisons";
import type { Preset } from "@/lib/presets";

// /llms.txt (issue #82), in the llmstxt.org format: an H1, a blockquote
// summary, then H2 sections of annotated links. Pure so it's testable.
export function buildLlmsTxt({
  origin,
  categories,
  presets,
  comparisons,
}: {
  origin: string;
  categories: Pick<Category, "slug" | "name">[];
  presets: Pick<Preset, "slug" | "title">[];
  comparisons: Pick<ComparisonSet, "slug" | "name">[];
}): string {
  const lines = [
    "# StudentStack",
    "",
    "> A free, hand-checked directory of student perks and opportunities: software discounts, cloud credits, scholarships, fellowships, internships, mentorships, and open-source programs, with a focus on what works for students in India. Every listing links to the official claim page and is re-checked weekly.",
    "",
    "All data below is free to read without an API key. Please cache responses and credit StudentStack with a link when you reuse it.",
    "",
    "## API",
    "",
    `- [List resources](${origin}/api/resources): JSON, paginated with \`page\` and \`limit\` (max 100). Filters: \`kind\` (perk, scholarship, fellowship, internship, mentorship, program; comma-separated), \`category\` (slug), \`region\` (IN or Global), \`deadline_before\` (ISO date).`,
    `- [Get one resource](${origin}/api/resources/github-copilot): JSON for a single resource by slug; 404 if unknown.`,
    `- [API documentation](${origin}/api-docs): parameters, response shape, limits, and examples.`,
    "",
    "## Feeds",
    "",
    `- [Deadlines calendar](${origin}/deadlines.ics): iCalendar feed of every listed deadline.`,
    `- [Deadlines RSS](${origin}/deadlines.rss): the same deadlines as RSS.`,
    "",
    "## Pages",
    "",
    `- [Directory](${origin}/directory): search and filter every listing.`,
    `- [Deadlines](${origin}/deadlines): opportunities by closing date.`,
    `- [Resource pages](${origin}/r/github-copilot): one page per listing at /r/{slug}.`,
    ...presets.map((p) => `- [${p.title}](${origin}/${p.slug})`),
    ...comparisons.map((c) => `- [${c.name}](${origin}/compare/${c.slug})`),
    "",
    "## Categories",
    "",
    ...categories.map((c) => `- [${c.name}](${origin}/directory?category=${c.slug}): category slug \`${c.slug}\``),
    "",
  ];
  return lines.join("\n");
}
