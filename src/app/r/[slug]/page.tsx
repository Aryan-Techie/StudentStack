import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getAllResources, getAllResourceSlugs, getResourceBySlug, type Resource } from "@/lib/resources";
import { getSiteUrl } from "@/lib/site";
import { relativeTime } from "@/lib/format";
import { SiteHeader } from "@/components/home/site-chrome";
import { ClaimButton } from "@/components/resource/claim-button";
import { passFontVariables } from "@/lib/fonts";
import homeStyles from "@/components/home/brand.module.css";
import dirStyles from "@/components/directory/directory.module.css";

// Resources change via admin CRUD and the link-health cron; without this,
// Next statically prerenders the page at build time and on-demand
// revalidation doesn't reliably re-run this Server Component in self-hosted
// mode. Force per-request rendering instead (same as /directory).
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const slugs = await getAllResourceSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

function pageDescription(resource: Resource): string {
  const base = resource.tagline ? `${resource.tagline}. ` : "";
  const text = `${base}${resource.description}`.replace(/\s+/g, " ").trim();
  return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);
  if (!resource) return {};
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/r/${resource.slug}`;
  const title = `${resource.name} — ${resource.tagline ?? "student discount"} | StudentStack`;
  const description = pageDescription(resource);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "StudentStack",
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

const VERIFICATION_LABELS: Record<string, string> = {
  none: "No verification required",
  edu_email: ".edu university email",
  github_student_pack: "GitHub Student Developer Pack",
  student_id: "Student ID upload",
};

const DURATION_LABELS: Record<string, string> = {
  one_time: "One-time perk",
  one_year: "1 year access",
  while_student: "Valid while enrolled",
  lifetime: "Lifetime access",
};

const COST_LABELS: Record<Resource["costType"], string> = {
  free: "Free",
  discount: "Discount",
  credits: "Credits",
  trial: "Free trial",
  stipend: "Stipend",
  scholarship: "Scholarship",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function jsonLd(resource: Resource, canonical: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: resource.name,
    description: pageDescription(resource),
    category: resource.categoryName,
    url: canonical,
    brand: { "@type": "Brand", name: resource.name },
    offers: {
      "@type": "Offer",
      url: resource.url ?? canonical,
      price: resource.costType === "free" ? "0" : undefined,
      priceCurrency: "USD",
      availability: resource.status === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      category: resource.categoryName,
    },
  };
  // Guard against `</script>` breaking out of the JSON-LD block.
  return JSON.stringify(data).replace(/<\//g, "<\\/");
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);
  if (!resource) notFound();

  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/r/${resource.slug}`;
  const verified = relativeTime(resource.lastVerifiedAt);

  const allResources = await getAllResources();
  const related = allResources
    .filter((r) => r.categoryId === resource.categoryId && r.id !== resource.id)
    .slice(0, 6);

  return (
    <div className={`${passFontVariables} ${homeStyles.root}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(resource, canonical) }} />
      <SiteHeader total={allResources.length} />
      <div className={dirStyles.root}>
        <main className={dirStyles.wrap}>
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">Home</Link>
            <span aria-hidden className="mx-2">/</span>
            <Link href="/directory" className="hover:underline">Directory</Link>
            <span aria-hidden className="mx-2">/</span>
            <span aria-current="page" className="text-foreground">{resource.name}</span>
          </nav>

          <article>
            <header className="mb-8">
              <div className="mb-4 flex items-center gap-3">
                <span aria-hidden className="text-4xl">{resource.categoryIcon}</span>
                <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/80 dark:text-amber-200">
                  {COST_LABELS[resource.costType]}
                </span>
                <span className="text-xs text-muted-foreground">{resource.region === "IN" ? "India" : "Global"}</span>
              </div>
              <h1 className={dirStyles.headline}>{resource.name}</h1>
              {resource.tagline ? <p className={dirStyles.subcopy}>{resource.tagline}</p> : null}
            </header>

            <p className="mb-8 max-w-2xl text-base leading-relaxed">{resource.description}</p>

            <div className="mb-10 flex flex-wrap items-center gap-3">
              {resource.hasStaticClaimUrl && resource.url ? (
                <ClaimButton resourceId={resource.id} url={resource.url} />
              ) : (
                <div className="rounded border px-3 py-1.5 text-xs text-muted-foreground bg-muted/30">
                  Varies by university or regional portal
                </div>
              )}
              {verified ? <span className="text-xs text-muted-foreground">{verified}</span> : null}
            </div>

            <dl className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Category">
                <Link href={`/directory?category=${resource.categorySlug}`} className="hover:underline">
                  {resource.categoryName}
                </Link>
              </DetailRow>
              <DetailRow label="Eligibility">
                {resource.verificationNeeded ? VERIFICATION_LABELS[resource.verificationNeeded] ?? "Check offer eligibility" : "Check offer eligibility"}
              </DetailRow>
              {resource.duration ? <DetailRow label="Duration">{DURATION_LABELS[resource.duration] ?? resource.duration}</DetailRow> : null}
              {resource.creditCardRequired !== null ? (
                <DetailRow label="Credit card">{resource.creditCardRequired ? "Required" : "Not required"}</DetailRow>
              ) : null}
              <DetailRow label="Region">{resource.region === "IN" ? "India" : "Global"}</DetailRow>
              {resource.deadline ? (
                <DetailRow label="Deadline">
                  {new Date(resource.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </DetailRow>
              ) : null}
            </dl>

            {resource.tags.length > 0 ? (
              <div className="mb-12 flex flex-wrap gap-2">
                {resource.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/directory?q=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground hover:underline"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : null}

            {related.length > 0 ? (
              <section aria-labelledby="related-heading" className="mb-8">
                <h2 id="related-heading" className="mb-4 text-xl font-semibold">
                  More in {resource.categoryName}
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border/60 bg-card/50 p-4">
                      <Link href={`/r/${r.slug}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      {r.tagline ? <p className="mt-1 text-sm text-muted-foreground">{r.tagline}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        </main>
      </div>
    </div>
  );
}
