"use server";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/admin/auth";
import { markCandidateReviewed, rejectPendingFromSource } from "@/lib/ingestion/queries";

export async function rejectCandidate(id: number) {
  await verifyAdmin();
  await markCandidateReviewed(id, "rejected");
  revalidatePath("/admin/ingestion");
}

// Clears a noisy source's queue in one go (issue #40). Rejected
// candidates are remembered by external id, so they won't come back.
export async function rejectAllFromSource(sourceName: string) {
  await verifyAdmin();
  await rejectPendingFromSource(sourceName);
  revalidatePath("/admin/ingestion");
}
