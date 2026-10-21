"use client";

import { useState } from "react";
import { Star } from "lucide-react";

// Read-only stars (issue #37). Rounds to the nearest half for display; the
// exact number is in the accessible label.
export function RatingStars({ value, size = 14, label }: { value: number; size?: number; label?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span role="img" aria-label={label ?? `${value.toFixed(1)} out of 5 stars`} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? "full" : rounded >= i - 0.5 ? "half" : "none";
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star className="absolute inset-0 text-muted-foreground/40" style={{ width: size, height: size }} />
            {fill !== "none" && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: fill === "half" ? size / 2 : size }}>
                <Star className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// 1-5 star picker as a radio group, keyboard accessible.
export function RatingInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label="Your rating" className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(i)}
          className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <Star className={`size-6 ${shown >= i ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}
