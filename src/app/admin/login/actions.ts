"use server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { isAdmin } from "@/lib/admin/roles";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/admin/login?error=${encodeURIComponent("Invalid email or password")}`);
  }
  const profile = data.user ? await getProfile(data.user.id).catch(() => null) : null;
  if (!isAdmin({ email, role: profile?.role })) {
    await supabase.auth.signOut();
    redirect(`/admin/login?error=${encodeURIComponent("Not an admin account")}`);
  }

  redirect("/admin");
}
