"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveBookmark } from "./actions";

// A signed-out student who clicked Save lands here as /my-list?save=<id>.
// Once they are signed in, finish that save and drop the query param.
export function PendingSave({ resourceId }: { resourceId: number }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    saveBookmark(resourceId)
      .catch(() => null)
      .finally(() => {
        router.replace("/my-list");
        router.refresh();
      });
  }, [resourceId, router]);

  return null;
}
