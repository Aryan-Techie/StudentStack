// Idempotent: upserts categories/resources from offers.json, plus
// student_resources.json when present and the curated flagship
// opportunities (issue #79).
// Re-run any time the raw data source changes: `pnpm db:seed`.
//
// Unlike the old delete-everything approach, re-seeding never wipes rows:
// existing records are matched by slug and only their normalized fields are
// refreshed. The admin-editable columns (verificationNeeded,
// creditCardRequired, duration) are backfilled only where currently NULL so
// manual /admin corrections survive a re-seed, and status is left untouched
// so link-health verdicts (broken/expired) are preserved.
import { sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { normalizeAll } from "./normalize-data";

async function main() {
  const { categories, resources, report } = normalizeAll(process.cwd());
  console.log(`Dataset: ${JSON.stringify(report)}`);

  await db.insert(schema.categories).values(categories).onConflictDoUpdate({
    target: schema.categories.slug,
    set: {
      name: sql`excluded."name"`,
      icon: sql`excluded."icon"`,
      sortOrder: sql`excluded."sort_order"`,
    },
  });

  const existingCategories = await db
    .select({ id: schema.categories.id, slug: schema.categories.slug })
    .from(schema.categories);
  const categoryIdBySlug = new Map(
    existingCategories.map((c) => [c.slug, c.id]),
  );

  const now = new Date();
  const resourceRows = resources.map((r) => {
    const categoryId = categoryIdBySlug.get(r.categorySlug);
    if (!categoryId) throw new Error(`unknown category slug ${r.categorySlug}`);
    return {
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      description: r.description,
      url: r.url,
      hasStaticClaimUrl: r.hasStaticClaimUrl,
      categoryId,
      tags: r.tags,
      region: r.region,
      regions: r.regions,
      regionLocked: r.regionLocked,
      costType: r.costType,
      verificationNeeded: r.verificationNeeded ?? null,
      creditCardRequired: r.creditCardRequired ?? null,
      duration: r.duration ?? null,
      kind: r.kind ?? "perk",
      opensAt: r.opensAt ?? null,
      deadline: r.deadline ?? null,
      recurrence: r.recurrence ?? null,
      amount: r.amount ?? null,
      provider: r.provider ?? null,
      eligibility: r.eligibility ?? null,
      status: r.status,
      createdAt: now,
      updatedAt: now,
    };
  });

  await db.insert(schema.resources).values(resourceRows).onConflictDoUpdate({
    target: schema.resources.slug,
    set: {
      name: sql`excluded."name"`,
      tagline: sql`excluded."tagline"`,
      description: sql`excluded."description"`,
      url: sql`excluded."url"`,
      hasStaticClaimUrl: sql`excluded."has_static_claim_url"`,
      categoryId: sql`excluded."category_id"`,
      tags: sql`excluded."tags"`,
      region: sql`excluded."region"`,
      regions: sql`excluded."regions"`,
      regionLocked: sql`excluded."region_locked"`,
      costType: sql`excluded."cost_type"`,
      // Backfill only: COALESCE keeps the stored value whenever an admin
      // has set one by hand (non-NULL), and takes the derived value only
      // for rows that were never populated.
      verificationNeeded: sql`COALESCE(${schema.resources.verificationNeeded}, excluded."verification_needed")`,
      creditCardRequired: sql`COALESCE(${schema.resources.creditCardRequired}, excluded."credit_card_required")`,
      duration: sql`COALESCE(${schema.resources.duration}, excluded."duration")`,
      // Opportunity fields (issue #79). The curated flagship file is the
      // reviewed source of truth for dates, so a non-NULL seeded value wins
      // and a new cycle's dates land on re-seed; NULL never wipes a date an
      // admin entered. Kind/amount/provider/recurrence/eligibility are
      // backfilled only where still NULL (or 'perk'), like the fields above.
      kind: sql`CASE WHEN ${schema.resources.kind} = 'perk' THEN excluded."kind" ELSE ${schema.resources.kind} END`,
      opensAt: sql`COALESCE(excluded."opens_at", ${schema.resources.opensAt})`,
      deadline: sql`COALESCE(excluded."deadline", ${schema.resources.deadline})`,
      recurrence: sql`COALESCE(${schema.resources.recurrence}, excluded."recurrence")`,
      amount: sql`COALESCE(${schema.resources.amount}, excluded."amount")`,
      provider: sql`COALESCE(${schema.resources.provider}, excluded."provider")`,
      eligibility: sql`COALESCE(${schema.resources.eligibility}, excluded."eligibility")`,
      updatedAt: sql`excluded."updated_at"`,
    },
  });

  console.log(`Seeded ${categories.length} categories and ${resources.length} resources.`);
  process.exit(0);
}

main();
