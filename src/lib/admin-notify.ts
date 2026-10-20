/**
 * Admin notifications for the weekly link-health cron (issue #41).
 *
 * PRD §8.6 requires the admin to get a summary notification when the cron
 * finds broken links. Until the Phase 5 email infrastructure exists, this
 * goes out as a webhook POST — Slack incoming webhooks and most generic
 * JSON webhooks accept `{ "text": "..." }`.
 *
 * Configure with the LINK_HEALTH_WEBHOOK_URL env var. When it is unset the
 * cron keeps its current behavior (console summary only): notifications
 * are strictly opt-in and never fail the cron run.
 */

export type BrokenLink = {
  id: number;
  url: string;
  previousStatus: string;
  newStatus: "broken" | "expired";
};

export type LinkHealthSummary = {
  checked: number;
  active: number;
  broken: number;
  expired: number;
  checkedAt: string;
};

export type NotifyResult = { sent: true } | { sent: false; reason: string };

/** Reads the webhook URL from the environment (null when unconfigured). */
export function getWebhookUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const url = env.LINK_HEALTH_WEBHOOK_URL?.trim();
  return url ? url : null;
}

/** Renders the plain-text notification body listing newly flagged links. */
export function buildBrokenLinksMessage(
  links: BrokenLink[],
  summary: LinkHealthSummary,
): string {
  const shown = links.slice(0, 20);
  const lines = shown.map(
    (link) => `- ${link.url} (${link.previousStatus} -> ${link.newStatus})`,
  );
  if (links.length > shown.length) {
    lines.push(`…and ${links.length - shown.length} more`);
  }
  return [
    `Link-health cron: ${links.length} newly flagged link${links.length === 1 ? "" : "s"}`,
    `Checked ${summary.checked} URLs — ${summary.active} active, ${summary.broken} broken, ${summary.expired} expired (${summary.checkedAt}).`,
    "",
    ...lines,
  ].join("\n");
}

/**
 * POSTs the broken-links summary to the configured webhook. Never throws:
 * a missing webhook, an HTTP error, or a network failure is reported in
 * the result so the cron can log it and finish normally.
 */
export async function notifyBrokenLinks(
  links: BrokenLink[],
  summary: LinkHealthSummary,
  options: {
    webhookUrl?: string | null;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<NotifyResult> {
  if (links.length === 0) {
    return { sent: false, reason: "no newly flagged links" };
  }
  const webhookUrl =
    options.webhookUrl !== undefined ? options.webhookUrl : getWebhookUrl();
  if (!webhookUrl) {
    return { sent: false, reason: "LINK_HEALTH_WEBHOOK_URL is not configured" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: buildBrokenLinksMessage(links, summary) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { sent: false, reason: `webhook returned HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
