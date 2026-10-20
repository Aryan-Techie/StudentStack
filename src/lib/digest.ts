import { createHmac, timingSafeEqual } from "node:crypto";

// Weekly digest email (PRD §8.12, issue #38): "New this week" + "Closing in
// 7 days". Pure helpers — selection windows, the email body, and signed
// unsubscribe links — so they can be unit tested without a DB or Resend.

export const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type DigestItem = {
  slug: string;
  name: string;
  tagline: string | null;
  amount?: string | null;
  deadline?: number | null; // epoch ms
};

export type DigestContent = { newThisWeek: DigestItem[]; closingSoon: DigestItem[] };

export function isDigestEmpty(content: DigestContent): boolean {
  return content.newThisWeek.length === 0 && content.closingSoon.length === 0;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function digestSubject(content: DigestContent): string {
  const parts: string[] = [];
  if (content.newThisWeek.length) parts.push(plural(content.newThisWeek.length, "new offer"));
  if (content.closingSoon.length) {
    parts.push(`${plural(content.closingSoon.length, "deadline")} closing soon`);
  }
  return `StudentStack Weekly — ${parts.join(", ")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

function itemDetail(item: DigestItem): string {
  const bits: string[] = [];
  if (item.tagline) bits.push(item.tagline);
  if (item.amount) bits.push(item.amount);
  if (item.deadline) bits.push(`closes ${deadlineFormat.format(item.deadline)}`);
  return bits.join(" · ");
}

// Plain table-free HTML with inline styles: renders in Gmail, Outlook, and
// Apple Mail without a template engine.
export function buildDigestHtml(content: DigestContent, origin: string, unsubscribeUrl: string): string {
  const section = (title: string, items: DigestItem[]) =>
    items.length === 0
      ? ""
      : `<h2 style="font-size:16px;margin:28px 0 8px">${escapeHtml(title)} (${items.length})</h2>
<ul style="padding-left:18px;margin:0">
${items
  .map((item) => {
    const detail = itemDetail(item);
    return `<li style="margin:0 0 10px"><a href="${escapeHtml(`${origin}/r/${item.slug}`)}" style="color:#4f46e5;font-weight:600">${escapeHtml(item.name)}</a>${detail ? `<br><span style="color:#555">${escapeHtml(detail)}</span>` : ""}</li>`;
  })
  .join("\n")}
</ul>`;

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0">StudentStack Weekly</h1>
${section("Closing in 7 days", content.closingSoon)}
${section("New this week", content.newThisWeek)}
<p style="margin-top:28px"><a href="${escapeHtml(`${origin}/directory`)}" style="color:#4f46e5">Browse the full directory</a> · <a href="${escapeHtml(`${origin}/deadlines`)}" style="color:#4f46e5">All deadlines</a></p>
<p style="color:#777;font-size:12px;margin-top:28px">You get this because you signed in to StudentStack. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#777">Unsubscribe</a></p>
</body></html>`;
}

export function buildDigestText(content: DigestContent, origin: string, unsubscribeUrl: string): string {
  const section = (title: string, items: DigestItem[]) =>
    items.length === 0
      ? []
      : [
          `${title} (${items.length})`,
          ...items.map((item) => {
            const detail = itemDetail(item);
            return `- ${item.name}${detail ? ` — ${detail}` : ""}\n  ${origin}/r/${item.slug}`;
          }),
          "",
        ];
  return [
    "StudentStack Weekly",
    "",
    ...section("Closing in 7 days", content.closingSoon),
    ...section("New this week", content.newThisWeek),
    `Browse the directory: ${origin}/directory`,
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
}

// Unsubscribe links are signed so nobody can opt someone else out by
// guessing a user id. The secret is DIGEST_SECRET, falling back to
// CRON_SECRET so the feature needs no extra configuration.
function digestSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.DIGEST_SECRET?.trim() || env.CRON_SECRET?.trim() || null;
}

export function signUnsubscribe(userId: string, secret: string | null = digestSecret()): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`digest-unsubscribe:${userId}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string, token: string, secret: string | null = digestSecret()): boolean {
  const expected = signUnsubscribe(userId, secret);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(origin: string, userId: string, token: string): string {
  return `${origin}/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
}
