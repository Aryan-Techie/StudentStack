import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { isAdmin } from "@/lib/admin/roles";

// Admin gate (PRD §8.5, made role-based in issue #42): an email in
// ADMIN_EMAIL or a profile with role "admin" (see src/lib/admin/roles.ts),
// checked here AND independently inside every admin Server Action, per
// Next.js's guidance that a layout/proxy check alone is not sufficient.
// Wrapped in React.cache so layout + page calls within a single RSC render
// pass only hit Supabase Auth once.
export const verifyAdmin = cache(async (): Promise<{ email: string }> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/admin/login");
  if (isAdmin({ email: user.email })) return { email: user.email };

  // Only look up the role when the email isn't allow-listed. A database
  // error fails closed.
  const profile = await getProfile(user.id).catch(() => null);
  if (!isAdmin({ email: user.email, role: profile?.role })) redirect("/admin/login");

  return { email: user.email };
});

