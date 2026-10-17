// Honest homepage copy (issue #77): the hero lede only names cost types
// that actually have live rows, so the site never promises scholarships
// or stipends before Phase 1 data lands. Counts come from
// getLiveCostTypeCounts() (approved + active rows).
const LEDE_PARTS: [string, string][] = [
  ["free", "Free software"],
  ["credits", "cloud credits"],
  ["scholarship", "scholarships"],
  ["stipend", "stipends"],
  ["discount", "discounts"],
];

export function heroLede(costCounts: Record<string, number>): string {
  const parts = LEDE_PARTS.filter(([costType]) => (costCounts[costType] ?? 0) > 0).map(
    ([, label]) => label,
  );
  const list =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
      : (parts[0] ?? "Student offers");
  return `${list}, sorted so you find yours fast. Found one we missed? Add it, and it goes live after a quick review.`;
}
