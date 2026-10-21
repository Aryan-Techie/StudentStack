// Grants or revokes /admin access for an existing account (issue #42):
//   pnpm dotenv -e .env.local -- tsx scripts/grant-admin.ts <email>
//   pnpm dotenv -e .env.local -- tsx scripts/grant-admin.ts <email> --revoke
// The person must have signed in once (via /submit or /my-list) so a
// Supabase Auth user exists. Uses the service-role key — never run this
// client-side. Addresses in ADMIN_EMAIL stay admins regardless of role.
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db, schema } from "../src/db";

async function findUserId(email: string): Promise<string | null> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) throw new Error("usage: tsx scripts/grant-admin.ts <email> [--revoke]");
  const role = flag === "--revoke" ? "student" : "admin";

  const userId = await findUserId(email);
  if (!userId) throw new Error(`no Supabase Auth user for ${email}; they need to sign in once first`);

  await db
    .insert(schema.profiles)
    .values({ userId, role })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: { role, updatedAt: sql`now()` } });

  console.log(`OK: ${email} (${userId}) is now ${role === "admin" ? "an admin" : "a student"}`);
  process.exit(0);
}

main();
