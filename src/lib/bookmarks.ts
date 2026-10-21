import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkStatus } from "@/lib/bookmark-status";

// Bookmarks + application tracker (PRD §8.7, issue #33). The app talks to
// Postgres as the table owner, so every caller must pass the user id it
// got from a verified Supabase session — never one taken from the client.

const bookmarks = schema.bookmarks;
const resources = schema.resources;

export async function getBookmarkStatuses(userId: string): Promise<Record<number, BookmarkStatus>> {
  const rows = await db
    .select({ resourceId: bookmarks.resourceId, status: bookmarks.status })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.resourceId, r.status]));
}

export type SavedResource = {
  resourceId: number;
  slug: string;
  name: string;
  tagline: string | null;
  url: string | null;
  hasStaticClaimUrl: boolean;
  deadline: Date | null;
  resourceStatus: "active" | "expired" | "broken";
  status: BookmarkStatus;
  savedAt: Date;
};

// Unapproved rows are skipped: a resource an admin un-approves drops off
// the list instead of leaking.
export async function getSavedResources(userId: string): Promise<SavedResource[]> {
  return db
    .select({
      resourceId: bookmarks.resourceId,
      slug: resources.slug,
      name: resources.name,
      tagline: resources.tagline,
      url: resources.url,
      hasStaticClaimUrl: resources.hasStaticClaimUrl,
      deadline: resources.deadline,
      resourceStatus: resources.status,
      status: bookmarks.status,
      savedAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(resources, eq(bookmarks.resourceId, resources.id))
    .where(and(eq(bookmarks.userId, userId), eq(resources.approved, true)))
    .orderBy(desc(bookmarks.createdAt));
}

export async function upsertBookmark(userId: string, resourceId: number, status: BookmarkStatus): Promise<void> {
  await db
    .insert(bookmarks)
    .values({ userId, resourceId, status })
    .onConflictDoUpdate({ target: [bookmarks.userId, bookmarks.resourceId], set: { status } });
}

export async function deleteBookmark(userId: string, resourceId: number): Promise<void> {
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.resourceId, resourceId)));
}

export async function isApprovedResource(resourceId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.id, resourceId), eq(resources.approved, true)))
    .limit(1);
  return Boolean(row);
}
