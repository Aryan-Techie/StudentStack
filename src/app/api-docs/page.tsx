import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import homeStyles from "@/components/home/brand.module.css";
import dirStyles from "@/components/directory/directory.module.css";

export const metadata: Metadata = {
  title: "API & Agents | StudentStack",
  description:
    "Free JSON API, calendar feeds, and llms.txt for StudentStack's directory of student perks, scholarships, and internships. For Discord bots, apps, and AI agents.",
  alternates: { canonical: `${getSiteUrl()}/api-docs` },
};

const PARAMS: [string, string][] = [
  ["page", "1-based page number. Default 1."],
  ["limit", "Items per page. Default 30, maximum 100."],
  ["kind", "Comma-separated: perk, scholarship, fellowship, internship, mentorship, program."],
  ["category", "Category slug, e.g. cloud-and-hosting. The full list is in /llms.txt."],
  ["region", "IN for offers that work in India, Global for offers not locked to any country."],
  ["deadline_before", "ISO date, e.g. 2026-12-31. Returns active listings still open now that close on or before it."],
];

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

function Block({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-4 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

// "API & Agents" (issue #82): documents the public read endpoints for
// student developers, bots, and AI agents.
export default function ApiDocsPage() {
  const origin = getSiteUrl();
  return (
    <div className={`${passFontVariables} ${homeStyles.root}`}>
      <SiteHeader />
      <div className={dirStyles.root}>
        <main className={`${dirStyles.wrap} max-w-3xl`}>
          <header className="mb-10">
            <h1 className={dirStyles.headline}>API &amp; Agents</h1>
            <p className={dirStyles.subcopy}>
              Everything in the directory is free to read: no key, no sign-up. Build a Discord bot, a campus app, or
              give your AI agent current student offers.
            </p>
          </header>

          <section className="mb-10 flex flex-col gap-4" aria-labelledby="list-heading">
            <h2 id="list-heading" className="text-xl font-semibold">
              List resources
            </h2>
            <Block>{`GET ${origin}/api/resources`}</Block>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th scope="col" className="py-2 pr-4 font-semibold">Parameter</th>
                    <th scope="col" className="py-2 font-semibold">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {PARAMS.map(([name, meaning]) => (
                    <tr key={name} className="border-b border-border/40 align-top">
                      <td className="py-2 pr-4">
                        <Code>{name}</Code>
                      </td>
                      <td className="py-2">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">Example: scholarships and fellowships for India closing before the end of 2026.</p>
            <Block>{`curl "${origin}/api/resources?kind=scholarship,fellowship&region=IN&deadline_before=2026-12-31"`}</Block>
            <p className="text-sm">The response is paginated:</p>
            <Block>{`{
  "resources": [{ "slug": "…", "name": "…", "kind": "scholarship", "deadline": 1767139200000, … }],
  "total": 42,
  "page": 1,
  "limit": 30,
  "totalPages": 2
}`}</Block>
            <p className="text-sm">
              Dates (<Code>deadline</Code>, <Code>opensAt</Code>, <Code>lastVerifiedAt</Code>) are Unix epoch
              milliseconds. Invalid parameters return <Code>400</Code> with an <Code>error</Code> message.
            </p>
          </section>

          <section className="mb-10 flex flex-col gap-4" aria-labelledby="one-heading">
            <h2 id="one-heading" className="text-xl font-semibold">
              Get one resource
            </h2>
            <Block>{`GET ${origin}/api/resources/{slug}`}</Block>
            <p className="text-sm">
              Returns one listing, or <Code>404</Code> if the slug is unknown. Slugs match the resource page URL:{" "}
              <Link href="/r/github-copilot" className="underline">
                /r/github-copilot
              </Link>{" "}
              is <Code>/api/resources/github-copilot</Code>.
            </p>
          </section>

          <section className="mb-10 flex flex-col gap-4" aria-labelledby="feeds-heading">
            <h2 id="feeds-heading" className="text-xl font-semibold">
              Feeds
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
              <li>
                <Link href="/deadlines.ics" className="underline">
                  /deadlines.ics
                </Link>{" "}
                — every deadline as an iCalendar feed. Subscribe in Google Calendar, Apple Calendar, or Outlook.
              </li>
              <li>
                <Link href="/deadlines.rss" className="underline">
                  /deadlines.rss
                </Link>{" "}
                — the same deadlines as RSS.
              </li>
              <li>
                <Link href="/llms.txt" className="underline">
                  /llms.txt
                </Link>{" "}
                — a plain-text map of the site and API for AI agents.
              </li>
            </ul>
          </section>

          <section className="mb-16 flex flex-col gap-3" aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="text-xl font-semibold">
              Limits and fair use
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
              <li>
                Responses are cached at the edge for 60 seconds. Please cache on your side too; the directory changes a
                few times a day at most.
              </li>
              <li>
                Up to 60 requests per minute per client. Over that you get <Code>429</Code> with a{" "}
                <Code>Retry-After</Code> header.
              </li>
              <li>When you show StudentStack data, link back to the resource page or to {origin}.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
