"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// "Claim / View offer" CTA for the per-resource page (/r/[slug]).
// Fire-and-forget click tracking, same as the directory cards — never blocks
// or delays navigation to the offer.
export function ClaimButton({
  resourceId,
  url,
  label = "Claim Offer",
}: {
  resourceId: number;
  url: string;
  label?: string;
}) {
  const handleClick = () => {
    try {
      fetch(`/api/resources/${resourceId}/click`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore — tracking must not break the link
    }
  };

  return (
    <Button asChild size="lg" className="gap-1.5 font-semibold">
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {label}
        <ArrowUpRight className="size-4" />
      </a>
    </Button>
  );
}
