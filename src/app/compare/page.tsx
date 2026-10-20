import type { Metadata } from "next";
import Link from "next/link";
import { COMPARISON_SETS } from "@/lib/comparisons";
import { getSiteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import homeStyles from "@/components/home/brand.module.css";
import dirStyles from "@/components/directory/directory.module.css";

export const metadata: Metadata = {
  title: "Compare student offers | StudentStack",
  description: "Side-by-side comparisons of overlapping student offers: cloud credits, AI coding assistants, and design tools.",
  alternates: { canonical: `${getSiteUrl()}/compare` },
};

export default function CompareIndexPage() {
  return (
    <div className={`${passFontVariables} ${homeStyles.root}`}>
      <SiteHeader />
      <div className={dirStyles.root}>
        <main className={dirStyles.wrap}>
          <header className="mb-8">
            <h1 className={dirStyles.headline}>Compare student offers</h1>
            <p className={dirStyles.subcopy}>
              Several companies give students the same kind of thing. These tables put them side by side.
            </p>
          </header>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMPARISON_SETS.map((set) => (
              <li key={set.slug} className="rounded-lg border border-border/60 bg-card/50 p-4">
                <Link href={`/compare/${set.slug}`} className="font-medium hover:underline">
                  {set.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{set.description}</p>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}
