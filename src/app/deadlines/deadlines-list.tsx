"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResourceCard } from "@/components/directory/resource-card";
import type { Resource } from "@/lib/resources";
import {
  CLOSING_SOON_DAYS,
  formatDeadline,
  isClosingSoon,
  relativeDeadline,
  urgencyTier,
  type UrgencyTier,
} from "@/lib/deadlines";
import dirStyles from "@/components/directory/directory.module.css";
import styles from "./deadlines.module.css";

const URGENCY_CLASS: Record<UrgencyTier, string> = {
  critical: styles.urgencyCritical,
  urgent: styles.urgencyUrgent,
  "closing-soon": styles.urgencyClosingSoon,
  upcoming: styles.urgencyUpcoming,
  past: styles.urgencyPast,
};

const URGENCY_BADGE: Partial<Record<UrgencyTier, string>> = {
  critical: "Critical",
  urgent: "Urgent",
  "closing-soon": "Closing soon",
};

function DeadlineCard({
  resource,
  nowMs,
  showRecurrence,
}: {
  resource: Resource;
  nowMs: number;
  showRecurrence?: boolean;
}) {
  const router = useRouter();
  const closingSoon = resource.deadline !== null && isClosingSoon(resource.deadline, nowMs);
  const tier = resource.deadline !== null ? urgencyTier(resource.deadline, nowMs) : "upcoming";
  const badge = URGENCY_BADGE[tier];

  return (
    <div className={`${styles.cardWrap} ${URGENCY_CLASS[tier]}`}>
      {resource.deadline !== null && (
        <p className={closingSoon ? styles.closingLine : styles.deadlineLine}>
          {badge && <span className={styles.closingBadge}>{badge}</span>}
          <span>
            Deadline {formatDeadline(resource.deadline)} · {relativeDeadline(resource.deadline, nowMs)}
          </span>
          {showRecurrence && resource.recurrence && (
            <span className={styles.recurrenceBadge}>Opens again ~{resource.recurrence}</span>
          )}
        </p>
      )}
      {(resource.amount || resource.provider) && (
        <p className={styles.metaLine}>
          {resource.amount && <span className={styles.amount}>{resource.amount}</span>}
          {resource.provider && <span>by {resource.provider}</span>}
        </p>
      )}
      <ResourceCard
        resource={resource}
        onTagClick={(tag) => router.push(`/directory?q=${encodeURIComponent(tag)}`)}
      />
    </div>
  );
}

function DeadlineSection({
  id,
  title,
  subcopy,
  resources,
  nowMs,
  showRecurrence,
}: {
  id: string;
  title: string;
  subcopy?: string;
  resources: Resource[];
  nowMs: number;
  showRecurrence?: boolean;
}) {
  if (resources.length === 0) return null;
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {title} <span className={styles.count}>{resources.length}</span>
      </h2>
      {subcopy && <p className={styles.sectionSub}>{subcopy}</p>}
      <div className={dirStyles.grid}>
        {resources.map((resource) => (
          <DeadlineCard key={resource.id} resource={resource} nowMs={nowMs} showRecurrence={showRecurrence} />
        ))}
      </div>
    </section>
  );
}

// `nowMs` comes from the server render that bucketed these resources, so
// the section, urgency tier, and "· in 3 days" label all agree, and the
// client's hydration pass prints the same text the server did (issue #118).
export function DeadlinesList({
  closingSoon,
  upcoming,
  past,
  nowMs,
}: {
  closingSoon: Resource[];
  upcoming: Resource[];
  past: Resource[];
  nowMs: number;
}) {
  if (closingSoon.length === 0 && upcoming.length === 0 && past.length === 0) {
    return (
      <p className={styles.empty} role="status">
        No deadlines on the books yet. Deadlines show up here once they&rsquo;re added to an
        offer — check the <Link href="/directory">directory</Link> for everything else.
      </p>
    );
  }

  return (
    <div className={styles.sections}>
      <DeadlineSection
        id="closing-soon"
        title="Closing soon"
        subcopy={`These close within the next ${CLOSING_SOON_DAYS} days — apply now if you qualify.`}
        resources={closingSoon}
        nowMs={nowMs}
      />
      <DeadlineSection id="upcoming" title="Upcoming deadlines" resources={upcoming} nowMs={nowMs} />
      {past.length > 0 && (
        <details className={styles.pastDetails}>
          <summary className={styles.pastSummary}>
            Past deadlines <span className={styles.count}>{past.length}</span>
          </summary>
          <p className={styles.sectionSub}>
            Kept for reference — many of these run again next cycle.
          </p>
          <div className={dirStyles.grid}>
            {past.map((resource) => (
              <DeadlineCard key={resource.id} resource={resource} nowMs={nowMs} showRecurrence />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
