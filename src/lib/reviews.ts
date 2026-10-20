import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { RatingSummary, ReviewInput } from "@/lib/review-rules";

// Reviews + ratings (PRD §8.11, issue #37). The app connects as the table
// owner, so the rules RLS would enforce live in the Server Actions: only
// the signed-in author writes their own row, and reads are public.

const reviews = schema.reviews;

export type PublicReview = {
  id: number;
  rating: number;
  comment: string | null;
  verifiedStudent: boolean;
  createdAt: Date;
};

export type ReviewSort = "recent" | "highest";

function hasDatabase(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}

// One aggregate query for the whole directory.
export async function getRatingSummaries(): Promise<Record<number, RatingSummary>> {
  if (!hasDatabase()) return {};
  try {
    const rows = await db
      .select({
        resourceId: reviews.resourceId,
        average: sql<number>`avg(${reviews.rating})`,
        count: sql<number>`count(*)`,
      })
      .from(reviews)
      .groupBy(reviews.resourceId);
    return Object.fromEntries(
      rows.map((r) => [r.resourceId, { average: Number(r.average), count: Number(r.count) }]),
    );
  } catch (error) {
    console.warn("[reviews] summaries failed:", error instanceof Error ? error.message : error);
    return {};
  }
}

export async function getRatingSummary(resourceId: number): Promise<RatingSummary | null> {
  if (!hasDatabase()) return null;
  try {
    const [row] = await db
      .select({ average: sql<number>`avg(${reviews.rating})`, count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.resourceId, resourceId));
    const count = Number(row?.count ?? 0);
    return count > 0 ? { average: Number(row.average), count } : null;
  } catch (error) {
    console.warn("[reviews] summary failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// Author ids are never exposed: reviews show as anonymous students.
export async function getResourceReviews(resourceId: number, sort: ReviewSort = "recent"): Promise<PublicReview[]> {
  if (!hasDatabase()) return [];
  try {
    return await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        verifiedStudent: reviews.verifiedStudent,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.resourceId, resourceId))
      .orderBy(...(sort === "highest" ? [desc(reviews.rating), desc(reviews.createdAt)] : [desc(reviews.createdAt)]))
      .limit(50);
  } catch (error) {
    console.warn("[reviews] list failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getUserReview(userId: string, resourceId: number) {
  const [row] = await db
    .select({ rating: reviews.rating, comment: reviews.comment })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.resourceId, resourceId)))
    .limit(1);
  return row ?? null;
}

export async function hasBookmarked(userId: string, resourceId: number): Promise<boolean> {
  const [row] = await db
    .select({ resourceId: schema.bookmarks.resourceId })
    .from(schema.bookmarks)
    .where(and(eq(schema.bookmarks.userId, userId), eq(schema.bookmarks.resourceId, resourceId)))
    .limit(1);
  return Boolean(row);
}

export async function upsertReview(
  userId: string,
  resourceId: number,
  input: ReviewInput,
  verifiedStudent: boolean,
): Promise<void> {
  const now = new Date();
  await db
    .insert(reviews)
    .values({ userId, resourceId, ...input, verifiedStudent, updatedAt: now })
    .onConflictDoUpdate({
      target: [reviews.resourceId, reviews.userId],
      set: { ...input, verifiedStudent, updatedAt: now },
    });
}

export async function deleteReview(userId: string, resourceId: number): Promise<void> {
  await db.delete(reviews).where(and(eq(reviews.userId, userId), eq(reviews.resourceId, resourceId)));
}
