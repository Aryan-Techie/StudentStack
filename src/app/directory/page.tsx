import { Suspense } from "react";
import Link from "next/link";
import { DirectoryClient } from "@/components/directory/directory-client";
import { DirectorySkeleton } from "@/components/directory/directory-skeleton";
import { BookmarksProvider } from "@/components/bookmarks/bookmarks-provider";
import { SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import { getAllResources, getAllTags, getCategories, getResourceCount } from "@/lib/resources";
import { PRESETS } from "@/lib/presets";
import { getRatingSummaries } from "@/lib/reviews";
import dirStyles from "@/components/directory/directory.module.css";
import homeStyles from "@/components/home/brand.module.css";

// Resources change via admin CRUD and the link-health cron; without this,
// Next statically prerenders the page at build time and revalidatePath's
// on-demand regeneration doesn't reliably re-run this Server Component in
// self-hosted mode. Force per-request rendering instead.
export const dynamic = "force-dynamic";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [rows, categories, total, ratings] = await Promise.all([
    getAllResources(),
    getCategories(),
    getResourceCount(),
    getRatingSummaries(),
  ]);
  const resources = rows.map((r) => (ratings[r.id] ? { ...r, rating: ratings[r.id] } : r));
  const allTags = getAllTags(resources);
  const { q } = await searchParams;
  const count = resources.length || total;

  return (
    <div className={`${passFontVariables} ${homeStyles.root}`}>
      <SiteHeader total={total} />
      <div className={dirStyles.root}>
        <main className={dirStyles.wrap}>
          <section className={dirStyles.hero}>
            <p className={dirStyles.eyebrow}>
              <span className={dirStyles.eyebrowDot} aria-hidden />
              The student directory
            </p>
            <h1 className={dirStyles.headline}>
              Your student perks. <span className={dirStyles.headlineAccent}>All in one place.</span>
            </h1>
            <p className={dirStyles.subcopy}>
              Free tools, cloud credits, scholarships and discounts. Find what works for you.
            </p>
            <form action="/directory" method="GET" role="search" className={dirStyles.searchBar}>
              <span className={dirStyles.searchIcon} aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </span>
              <label htmlFor="dir-search" className="sr-only">Search offers</label>
              <input
                id="dir-search"
                name="q"
                type="search"
                defaultValue={q ?? ""}
                placeholder={`Search ${count} offers...`}
                className={dirStyles.searchInput}
              />
              <button type="submit" className={dirStyles.searchBtn}>Search</button>
            </form>
            <div className={dirStyles.presets}>
              <Link href="/directory" className={`${dirStyles.preset} ${dirStyles.presetActive}`}>All offers</Link>
              {PRESETS.map((p) => (
                <Link key={p.slug} href={`/${p.slug}`} className={dirStyles.preset}>
                  {p.label}
                </Link>
              ))}
            </div>
          </section>
          <Suspense fallback={<DirectorySkeleton />}>
            <BookmarksProvider>
              <DirectoryClient resources={resources} categories={categories} allTags={allTags} />
            </BookmarksProvider>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
