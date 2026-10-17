// Single source of truth for the public base URL — canonical links, sitemap,
// robots.txt, OpenGraph, and JSON-LD all build absolute URLs from this.
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://studentstack.vercel.app");
  return raw.replace(/\/+$/, "");
}
