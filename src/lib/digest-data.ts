import "server-only";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DIGEST_WINDOW_MS, type DigestContent } from "@/lib/digest";

const resources = schema.resources;
const MAX_ITEMS = 10;

// "New this week": approved, active rows created in the last 7 days.
// "Closing in 7 days": approved, active rows whose deadline falls in the
// next 7 days, soonest first.
export async function getDigestContent(now: Date = new Date()): Promise<DigestContent> {
  const weekAgo = new Date(now.getTime() - DIGEST_WINDOW_MS);
  const weekAhead = new Date(now.getTime() + DIGEST_WINDOW_MS);
  const columns = {
    slug: resources.slug,
    name: resources.name,
    tagline: resources.tagline,
    amount: resources.amount,
    deadline: resources.deadline,
  };
  const live = and(eq(resources.approved, true), eq(resources.status, "active"));
  const [fresh, closing] = await Promise.all([
    db
      .select(columns)
      .from(resources)
      .where(and(live, gte(resources.createdAt, weekAgo)))
      .orderBy(resources.createdAt)
      .limit(MAX_ITEMS),
    db
      .select(columns)
      .from(resources)
      .where(and(live, isNotNull(resources.deadline), gte(resources.deadline, now), lte(resources.deadline, weekAhead)))
      .orderBy(resources.deadline)
      .limit(MAX_ITEMS),
  ]);
  const toItem = (r: (typeof fresh)[number]) => ({ ...r, deadline: r.deadline ? r.deadline.getTime() : null });
  return { newThisWeek: fresh.map(toItem), closingSoon: closing.map(toItem) };
}

export type DigestRecipient = { userId: string; email: string };

// Every Supabase Auth user with a confirmed email, minus anyone who turned
// the digest off. Needs SUPABASE_SERVICE_ROLE_KEY.
export async function getDigestRecipients(optOuts: Set<string>): Promise<DigestRecipient[]> {
  const supabase = createAdminSupabaseClient();
  const recipients: DigestRecipient[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email && user.email_confirmed_at && !optOuts.has(user.id)) {
        recipients.push({ userId: user.id, email: user.email });
      }
    }
    if (data.users.length < perPage) break;
  }
  return recipients;
}
