import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Student profiles (issue #34). As with bookmarks, callers pass the user id
// from a verified Supabase session, never one supplied by the client.

export type Profile = typeof schema.profiles.$inferSelect;

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  return row ?? null;
}

export async function saveProfile(
  userId: string,
  fields: { branch: string | null; year: number | null },
): Promise<void> {
  const now = new Date();
  await db
    .insert(schema.profiles)
    .values({ userId, ...fields, completedOnboarding: true, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { ...fields, completedOnboarding: true, updatedAt: now },
    });
}
