import type { MetadataRoute } from "next";
import { getAllResourceSlugs } from "@/lib/resources";
import { getSiteUrl } from "@/lib/site";
import { PRESETS } from "@/lib/presets";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const slugs = await getAllResourceSlugs();

  return [
    { url: `${siteUrl}/`, lastModified: now },
    { url: `${siteUrl}/directory`, lastModified: now },
    { url: `${siteUrl}/deadlines`, lastModified: now },
    ...PRESETS.map((p) => ({
      url: `${siteUrl}/${p.slug}`,
      lastModified: now,
    })),
    // Per-resource SEO pages — approved resources only.
    ...slugs.map(({ slug, updatedAt }) => ({
      url: `${siteUrl}/r/${slug}`,
      lastModified: updatedAt,
    })),
  ];
}
