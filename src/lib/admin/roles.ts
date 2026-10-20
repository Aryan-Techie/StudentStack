// Admin authorization rules (issue #42). Pure, so they can be unit tested.
//
// Two ways to be an admin:
// 1. Your email is listed in ADMIN_EMAIL. It now accepts a comma-separated
//    list, and a single address still works, so existing deployments don't
//    change. This is the bootstrap path: it works before any profile exists.
// 2. Your `profiles.role` is "admin", granted with scripts/grant-admin.ts.
//    This lets more people moderate without redeploying with a new env var.

export const ROLES = ["student", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function adminEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(
  user: { email?: string | null; role?: Role | null },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (user.role === "admin") return true;
  return Boolean(user.email && adminEmails(env).has(user.email.toLowerCase()));
}
