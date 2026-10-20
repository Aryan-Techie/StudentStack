import { getDigestContent, getDigestRecipients } from "@/lib/digest-data";
import {
  buildDigestHtml,
  buildDigestText,
  digestSubject,
  isDigestEmpty,
  signUnsubscribe,
  unsubscribeUrl,
} from "@/lib/digest";
import { getEmailConfig, sendBatch, type OutgoingEmail } from "@/lib/email";
import { getDigestOptOuts } from "@/lib/profiles";
import { getSiteUrl } from "@/lib/site";

export const maxDuration = 300;

// Weekly digest (issue #38), triggered by Vercel Cron (see vercel.json).
// Skips cleanly when email isn't configured or there is nothing to send.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const config = getEmailConfig();
  if (!config) {
    return Response.json({ skipped: "RESEND_API_KEY or DIGEST_FROM_EMAIL is not configured" });
  }

  const content = await getDigestContent();
  if (isDigestEmpty(content)) return Response.json({ skipped: "nothing new or closing this week" });

  const origin = getSiteUrl();
  const subject = digestSubject(content);
  const recipients = await getDigestRecipients(await getDigestOptOuts());

  const emails: OutgoingEmail[] = recipients.flatMap(({ userId, email }) => {
    const token = signUnsubscribe(userId);
    if (!token) return [];
    const pageUrl = unsubscribeUrl(origin, userId, token);
    const oneClick = `${origin}/api/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
    return [
      {
        to: email,
        subject,
        html: buildDigestHtml(content, origin, pageUrl),
        text: buildDigestText(content, origin, pageUrl),
        // RFC 8058 one-click unsubscribe, which Gmail and Yahoo expect
        // from bulk senders.
        headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      },
    ];
  });

  const result = await sendBatch(emails, config);
  console.log(
    `[weekly-digest] ${result.sent} sent, ${result.failed} failed to ${recipients.length} recipients` +
      (result.errors.length ? `: ${result.errors.join("; ")}` : ""),
  );
  return Response.json({ recipients: recipients.length, ...result });
}
