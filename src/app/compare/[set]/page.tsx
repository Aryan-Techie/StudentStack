import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getResourcesForSlugs, type Resource } from "@/lib/resources";
import { COMPARISON_SETS, getComparisonSet, orderForSet } from "@/lib/comparisons";
import { COST_LABELS, DURATION_LABELS, VERIFICATION_LABELS } from "@/lib/resource-labels";
import { getSiteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import homeStyles from "@/components/home/brand.module.css";
import dirStyles from "@/components/directory/directory.module.css";

// Same reasoning as /r/[slug]: rows change via admin CRUD and the
// link-health cron, so render per request.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return COMPARISON_SETS.map((set) => ({ set: set.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ set: string }>;
}): Promise<Metadata> {
  const { set: slug } = await params;
  const set = getComparisonSet(slug);
  if (!set) return {};
  const canonical = `${getSiteUrl()}/compare/${set.slug}`;
  const title = `${set.name} | StudentStack`;
  return {
    title,
    description: set.description,
    alternates: { canonical },
    openGraph: { title, description: set.description, url: canonical, siteName: "StudentStack" },
  };
}

type Column = { label: string; value: (r: Resource) => React.ReactNode };

const COLUMNS: Column[] = [
  { label: "What you get", value: (r) => r.tagline ?? "—" },
  { label: "Cost type", value: (r) => COST_LABELS[r.costType] },
  {
    label: "Verification",
    value: (r) => (r.verificationNeeded ? VERIFICATION_LABELS[r.verificationNeeded] : "Not reviewed"),
  },
  {
    label: "Credit card",
    value: (r) =>
      r.creditCardRequired === null ? "Not reviewed" : r.creditCardRequired ? "Required" : "Not required",
  },
  { label: "Duration", value: (r) => (r.duration ? DURATION_LABELS[r.duration] : "Not reviewed") },
  { label: "Region", value: (r) => (r.region === "IN" ? "India" : "Global") },
  { label: "Platforms", value: (r) => (r.tags.length ? r.tags.join(", ") : "—") },
];

export default async function ComparePage({
  params,
}: {
  params: Promise<{ set: string }>;
}) {
  const { set: slug } = await params;
  const set = getComparisonSet(slug);
  if (!set) notFound();

  const rows = orderForSet(set, await getResourcesForSlugs(set.resourceSlugs));

  return (
    <div className={`${passFontVariables} ${homeStyles.root}`}>
      <SiteHeader />
      <div className={dirStyles.root}>
        <main className={dirStyles.wrap}>
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">Home</Link>
            <span aria-hidden className="mx-2">/</span>
            <Link href="/compare" className="hover:underline">Compare</Link>
            <span aria-hidden className="mx-2">/</span>
            <span aria-current="page" className="text-[var(--d-ink)]">{set.name}</span>
          </nav>

          <header className="mb-8">
            <h1 className={dirStyles.headline}>{set.name}</h1>
            <p className={dirStyles.subcopy}>{set.description}</p>
          </header>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers in this comparison are live right now.</p>
          ) : (
            <div className="mb-12 overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">{set.name}</caption>
                <thead className="bg-[var(--d-surface)]">
                  <tr>
                    <th scope="col" className="sticky left-0 bg-[var(--d-surface)] px-4 py-3 font-semibold">Offer</th>
                    {COLUMNS.map((c) => (
                      <th key={c.label} scope="col" className="px-4 py-3 font-semibold">{c.label}</th>
                    ))}
                    <th scope="col" className="px-4 py-3 font-semibold">Claim</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60 align-top">
                      <th scope="row" className="sticky left-0 bg-[var(--d-ground)] px-4 py-3 font-medium">
                        <Link href={`/r/${r.slug}`} className="hover:underline">{r.name}</Link>
                        {r.status !== "active" ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">({r.status})</span>
                        ) : null}
                      </th>
                      {COLUMNS.map((c) => (
                        <td key={c.label} className="px-4 py-3">{c.value(r)}</td>
                      ))}
                      <td className="px-4 py-3">
                        {r.hasStaticClaimUrl && r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                            Claim ↗
                          </a>
                        ) : (
                          <Link href={`/r/${r.slug}`} className="hover:underline">Details</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section aria-labelledby="more-heading">
            <h2 id="more-heading" className="mb-4 text-xl font-semibold">More comparisons</h2>
            <ul className="flex flex-wrap gap-3">
              {COMPARISON_SETS.filter((s) => s.slug !== set.slug).map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/compare/${s.slug}`}
                    className="inline-flex rounded-lg border border-[var(--d-line)] bg-[var(--d-surface)] px-4 py-2 text-sm font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
