<div align="center">

# StudentStack

**Free tools, discounts, credits, and opportunities for students — filtered to what you can actually use.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase)](https://supabase.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-c5f74f?logo=drizzle)](https://orm.drizzle.team/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Features](#features) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Using the Directory](#using-the-directory) • [Admin Dashboard](#admin-dashboard) • [Data Workflow](#data-workflow)

</div>

---

StudentStack is a student-first resource directory for finding useful software, cloud credits, certifications, and other student offers — without digging through stale, single-category lists. The seeded dataset contains **593 resources across 15 categories**, with filters for category, region, cost type, and tags. Search is typo-tolerant, filters are reflected in the URL, and every resource carries a link-health status that a weekly cron job keeps current.

> [!NOTE]
> StudentStack runs on **your own Supabase (Postgres) project**. See [Getting Started](#getting-started) for how to provision one and wire up the environment variables.

---

## Features

- **Searchable directory** with typo-tolerant matching powered by [Fuse.js](https://www.fusejs.io/).
- **Composable filters** for category, region, cost type, and tags — all reflected as shareable query parameters (`q`, `category`, `region`, `cost`, `tags`).
- **Automated link-health checks** — a weekly Vercel Cron job re-verifies every claimable URL and flips resources between `active`/`broken`, so cards never point at a dead link for long.
- **Claim-aware cards** that distinguish direct claim links from offers that vary by region and have no single static URL.
- **Live homepage counts** for resources and categories, read straight from the database at request time.
- **Minimal admin dashboard** (single allow-listed account, gated by Supabase Auth) for creating, editing, and retiring resources without touching the database directly.
- **Responsive UI** designed for students browsing primarily on mobile.
- **Opportunities alongside perks** — each resource has a `kind` (`perk`, `scholarship`, `fellowship`, `internship`, `mentorship`, `program`) plus optional opens-at date, deadline, recurrence, amount, provider, and structured eligibility, all editable in `/admin`.
- **Student submission flow** at `/submit` (Google or email-link sign-in via Supabase Auth); submissions stay hidden until approved from the review queue in `/admin`.

---

## Architecture

```text
offers.json → scripts/normalize-data.ts → scripts/seed.ts → Supabase Postgres → Next.js
                                                                      ↑
                                                     /api/cron/link-health (weekly)
```

| Layer | Technology |
|-------|------------|
| **Frontend/Backend** | [Next.js](https://nextjs.org/) 16 (App Router, Turbopack), [React](https://react.dev/) 19, TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) 4 (CSS-first `@theme`), Radix primitives, shadcn-style UI components |
| **Database** | Postgres via your own [Supabase](https://supabase.com/) project, queried with [Drizzle ORM](https://orm.drizzle.team/) |
| **Auth** | Supabase Auth, gating `/admin` behind a single allow-listed email (`ADMIN_EMAIL`) |
| **Scheduled Jobs** | [Vercel Cron](https://vercel.com/docs/cron-jobs) triggers `/api/cron/link-health` every Monday 03:00 UTC |
| **Client-Side Search** | [Fuse.js](https://www.fusejs.io/) fuzzy-matches across name, offer, description, and tags |

```text
src/
├── app/
│   ├── page.tsx                           # Homepage (Student Pass design)
│   ├── directory/page.tsx                 # Directory route with search & filters
│   ├── admin/                             # Login + dashboard (Supabase Auth-gated)
│   ├── submit/                            # Student submission flow
│   └── api/cron/link-health/route.ts      # Weekly link-health check
├── components/
│   ├── directory/                         # Search, filters, cards, loading UI
│   ├── admin/                             # Resource create/edit form
│   ├── home/                              # Student Pass card, category wallet
│   └── ui/                                # Reusable interface primitives
├── db/
│   ├── index.ts                           # Postgres/Drizzle connection
│   └── schema.ts                          # Drizzle schema (categories, resources, bookmarks, reviews, click events)
├── lib/
│   ├── resources.ts                       # Resource and category queries
│   ├── link-health.ts                     # URL health-check logic
│   ├── admin/auth.ts                      # Admin session verification
│   ├── supabase/                          # Supabase client helpers (browser + server)
│   └── ingestion/                         # Resource ingestion pipeline
└── proxy.ts                               # Next.js 16 middleware equivalent — refreshes admin sessions

scripts/
├── normalize-data.ts                      # Raw offers.json → normalized rows
├── seed.ts                                # Reload categories/resources into Postgres
└── create-admin.ts                        # One-time bootstrap of the admin Supabase Auth user

drizzle/
├── 0000_baseline.sql                      # Schema as it was before migrations were tracked
├── 0001_opportunity_fields.sql            # Opportunity columns on resources and ingestion candidates
└── meta/                                  # drizzle-kit snapshots and journal
```

Product and design decisions are documented in [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), and [student-resources-prd.md](student-resources-prd.md); implementation notes and judgment calls are logged in [PROGRESS.md](PROGRESS.md).

---

## Getting Started

### Prerequisites

- Node.js LTS
- [pnpm](https://pnpm.io/installation) 11 or later
- A [Supabase](https://supabase.com/) project (free tier is enough)

### 1. Provision Supabase

Create a project, then grab the connection strings and API keys from **Project Settings → Database/API**.

> [!IMPORTANT]
> Use the **Supavisor pooler** host for both connection strings, just on different ports — the direct `db.<ref>.supabase.co` host is IPv6-only unless you've purchased the IPv4 add-on, and migrations will fail to connect through it.

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

```env
POSTGRES_URL=              # Supavisor pooler, Transaction mode (port 6543) — app runtime
POSTGRES_URL_NON_POOLING=  # Supavisor pooler, Session mode (port 5432) — drizzle-kit migrations
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY= # server-only, used by scripts/create-admin.ts
ADMIN_EMAIL=               # the one account allowed into /admin
CRON_SECRET=               # Vercel Cron sends this as a Bearer token
```

### 3. Install, Migrate, and Seed

```bash
pnpm install
pnpm db:push
pnpm db:seed
```

> [!IMPORTANT]
> `offers.json` is intentionally ignored by Git. A fresh clone needs the raw seed input available at the repository root before running `pnpm db:seed`. The bundled dataset produces 593 resources across 15 categories.

### 4. (Optional) Create the Admin Account

```bash
pnpm dotenv -e .env.local -- tsx scripts/create-admin.ts you@example.com <password>
```

The email must match `ADMIN_EMAIL`.

### 5. Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Using the Directory

1. Open the homepage and choose **Browse the directory**.
2. Search by resource name, offer, description, or tag — small spelling mistakes are supported.
3. Combine category, region, cost, and tag filters as needed.
4. Use the filter chips to remove individual selections, or choose **Clear all**.
5. Open a resource's official claim link when one is available. Region-dependent offers are labelled "Varies by region" when no single static link exists.

Filter state lives in the URL, so any search can be shared or bookmarked as-is:

```text
/directory?q=github&category=development-tools&region=Global&cost=free
```

---

## Admin Dashboard

`/admin` is a minimal dashboard for managing resources without direct database access — create, edit, flip status (`active`/`expired`/`broken`), and delete. It's gated by Supabase Auth to a single allow-listed email (`ADMIN_EMAIL`); every Server Action re-verifies that check independently of the proxy-level redirect, since Next.js middleware alone isn't a sufficient security boundary.

The create/edit form also covers the opportunity fields: kind, opens-at and deadline dates, recurrence (e.g. "annual, opens Feb"), amount, provider, and an eligibility fieldset (study levels, countries, states, fields of study, minimum year, maximum age, gender, income cap in INR). Leave a field empty when the opportunity is open on that axis. Creating a resource from an ingestion candidate pre-fills these fields from the candidate.

---

## Data Workflow

The raw export is normalized before it's inserted into Postgres:

```text
offers.json → scripts/normalize-data.ts → scripts/seed.ts → Supabase
```

Normalization maps source categories, regions, cost types, tags, descriptions, and claim URLs into the app's schema. `pnpm db:seed` is idempotent — it clears and reloads the `categories` and `resources` tables every time it runs, so it's safe to re-run whenever `offers.json` changes.

The directory currently loads the full dataset server-side and filters in memory — intentional at ~600 rows, and a paginated query layer can be introduced later if the dataset grows significantly.

Schema changes are tracked as migrations under [`drizzle/`](drizzle). `0000_baseline.sql` is the schema before migrations were introduced and `0001_opportunity_fields.sql` adds the opportunity columns. A database first set up with `pnpm db:push` has no migration history: keep using `pnpm db:push` there, or apply only the new migration files by hand. Don't run `0000_baseline.sql` against an existing database.

---

## Link-Health Checks

`GET /api/cron/link-health`, triggered weekly by Vercel Cron (see [`vercel.json`](vercel.json)), re-checks every resource that has a static claim URL and hasn't been manually marked `expired`. It issues a `HEAD` request (falling back to `GET` on `405`/`501`), classifies the result as `active` or `broken`, and revalidates the homepage and directory so status changes show up immediately. The route requires a `Bearer ${CRON_SECRET}` header and runs up to 25 checks concurrently.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the local Next.js development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm db:push` | Push the Drizzle schema to Postgres |
| `pnpm db:generate` | Generate a migration under `drizzle/` from schema changes |
| `pnpm db:migrate` | Apply pending `drizzle/` migrations |
| `pnpm db:seed` | Reload categories and resources from `offers.json` |
| `pnpm db:studio` | Open Drizzle Studio to inspect the database |
| `pnpm test` | Run unit tests with Vitest |
| `pnpm test:e2e` | Run end-to-end tests with Playwright |

---

## Design System

The homepage and `/submit` follow a custom **Student Pass** design system (see [DESIGN.md](DESIGN.md)):

- **Creative North Star**: The Student Pass — an amber ID-1 card that flips to reveal the categories it unlocks
- **One Amber Rule**: Amber marks the card and primary actions; three pass colors (cobalt, mint, lilac) live only in the category wallet
- **Real Numbers Rule**: Every count on the page comes from the database at request time — no placeholder stats
- **Typography**: Display = Anybody (variable width); Body = Atkinson Hyperlegible Next; Data = Atkinson Hyperlegible Mono
- **Elevation**: Flat by default; only the card and category passes have physical shadows
- **Motion**: Card settles on load (700ms), flip is 700ms, pass lift 280ms — all disabled under `prefers-reduced-motion`

The directory, preset pages, and admin still use the earlier token set in `src/app/globals.css` until they are restyled.

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import the repository in Vercel
3. Add all environment variables from `.env.local`
4. Enable **Vercel Cron** for the weekly link-health check (configured in `vercel.json`)
5. Deploy

### Other Platforms

Any platform that supports Node.js 20+ and can run `pnpm build && pnpm start` will work. Ensure you:
- Set all required environment variables
- Configure a cron/scheduler to hit `/api/cron/link-health` weekly with the `CRON_SECRET` Bearer token
- Run `pnpm db:push` and `pnpm db:seed` against your Supabase project before deploying

---

## Current Scope

The current implementation focuses on fast discovery, trustworthy resource metadata, and low-effort admin curation. The schema already includes tables for bookmarks, reviews, and click events, but those flows aren't exposed in the UI yet — they're planned for a future phase that extends the existing Supabase Auth setup to real user accounts. Multi-admin roles remain out of scope for now.

---

## License

MIT — see [LICENSE](LICENSE) for details.