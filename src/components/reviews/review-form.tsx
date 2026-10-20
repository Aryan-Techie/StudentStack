"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMyReview, submitReview } from "@/app/reviews/actions";
import { MAX_COMMENT_LENGTH } from "@/lib/review-rules";
import { RatingInput } from "./rating-stars";

type Mine = { signedIn: boolean; canReview: boolean; review: { rating: number; comment: string | null } | null };

// "Write a review" on /r/[slug] (issue #37). Loads the student's own review
// client-side so the page itself stays a shared render.
export function ReviewForm({ resourceId, slug }: { resourceId: number; slug: string }) {
  const router = useRouter();
  const [mine, setMine] = useState<Mine | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?resourceId=${resourceId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Mine | null) => {
        if (cancelled || !data) return;
        setMine(data);
        if (data.review) {
          setRating(data.review.rating);
          setComment(data.review.comment ?? "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  if (!mine) return null;

  if (!mine.signedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={`/my-list?save=${resourceId}`} className="underline">
          Sign in and save this offer
        </Link>{" "}
        to review it.
      </p>
    );
  }

  if (!mine.canReview) {
    return <p className="text-sm text-muted-foreground">Save this offer to your list to review it.</p>;
  }

  const editing = Boolean(mine.review);

  return (
    <form
      className="flex max-w-xl flex-col gap-3 rounded-lg border border-border/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await submitReview(resourceId, slug, rating, comment);
          if (!result.ok) return setMessage(result.error);
          setMine({ ...mine, review: { rating, comment: comment.trim() || null } });
          setMessage(editing ? "Review updated." : "Thanks, your review is live.");
          router.refresh();
        });
      }}
    >
      <p className="font-medium">{editing ? "Your review" : "Write a review"}</p>
      <RatingInput value={rating} onChange={setRating} />
      <label className="flex flex-col gap-1 text-sm">
        <span>What was it like? (optional)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          className="rounded border border-border bg-background px-3 py-2"
        />
      </label>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending || rating === 0}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {editing ? "Update review" : "Post review"}
        </button>
        {editing && (
          <button
            type="button"
            disabled={pending}
            className="text-sm text-muted-foreground underline"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await deleteMyReview(resourceId, slug);
                if (!result.ok) return setMessage(result.error);
                setMine({ ...mine, review: null });
                setRating(0);
                setComment("");
                setMessage("Review deleted.");
                router.refresh();
              });
            }}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
