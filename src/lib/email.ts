// Email sending through Resend's HTTP API (issue #38). Plain fetch instead
// of an SDK: the digest only needs the batch endpoint. RESEND_API_KEY is set
// by the Vercel Marketplace Resend integration; DIGEST_FROM_EMAIL is the
// verified sender, e.g. "StudentStack <digest@studentstack.app>".

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type EmailConfig = { apiKey: string; from: string };

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.DIGEST_FROM_EMAIL?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

const BATCH_SIZE = 100; // Resend's per-request batch limit

export type SendResult = { sent: number; failed: number; errors: string[] };

// Sends in batches of 100. Never throws: a failed batch is counted and the
// rest still go out.
export async function sendBatch(
  emails: OutgoingEmail[],
  config: EmailConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] };
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetchImpl("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((e) => ({ from: config.from, ...e }))),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        result.sent += chunk.length;
      } else {
        result.failed += chunk.length;
        result.errors.push(`Resend returned HTTP ${res.status}`);
      }
    } catch (error) {
      result.failed += chunk.length;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return result;
}
