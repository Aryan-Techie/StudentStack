// One-time bootstrap: `pnpm dotenv -e .env.local -- tsx scripts/create-admin.ts <email> <password>`
// Creates a Supabase Auth user listed in ADMIN_EMAIL (comma-separated) for
// /admin; see scripts/grant-admin.ts for promoting existing users. Uses the
// service-role key — never run this client-side.
import { createClient } from "@supabase/supabase-js";
import { adminEmails } from "../src/lib/admin/roles";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    throw new Error("usage: tsx scripts/create-admin.ts <email> <password>");
  }
  if (!adminEmails().has(email.toLowerCase())) {
    throw new Error(`email must be listed in ADMIN_EMAIL (${process.env.ADMIN_EMAIL})`);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;
  console.log(`OK: created admin user ${data.user.email} (${data.user.id})`);
  process.exit(0);
}

main();
