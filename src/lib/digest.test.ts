import { describe, it, expect, vi } from "vitest";
import {
  buildDigestHtml,
  buildDigestText,
  digestSubject,
  isDigestEmpty,
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
  type DigestContent,
} from "@/lib/digest";
import { getEmailConfig, sendBatch, type OutgoingEmail } from "@/lib/email";

const content: DigestContent = {
  newThisWeek: [
    { slug: "figma", name: "Figma", tagline: "Free Pro plan" },
    { slug: "x", name: "<script>X</script>", tagline: null },
  ],
  closingSoon: [
    { slug: "gsoc", name: "Google Summer of Code", tagline: null, amount: "$1,500–6,600", deadline: Date.UTC(2026, 3, 8) },
  ],
};

describe("digest content", () => {
  it("builds a subject from the counts", () => {
    expect(digestSubject(content)).toBe("StudentStack Weekly — 2 new offers, 1 deadline closing soon");
    expect(digestSubject({ newThisWeek: [], closingSoon: content.closingSoon })).toBe(
      "StudentStack Weekly — 1 deadline closing soon",
    );
  });

  it("detects an empty digest", () => {
    expect(isDigestEmpty({ newThisWeek: [], closingSoon: [] })).toBe(true);
    expect(isDigestEmpty(content)).toBe(false);
  });

  it("renders both sections with links and escapes HTML", () => {
    const html = buildDigestHtml(content, "https://s.test", "https://s.test/unsub");
    expect(html).toContain("Closing in 7 days (1)");
    expect(html).toContain("New this week (2)");
    expect(html).toContain('href="https://s.test/r/figma"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("https://s.test/unsub");
    expect(html).toContain("$1,500–6,600");
  });

  it("renders a plain-text alternative", () => {
    const text = buildDigestText(content, "https://s.test", "https://s.test/unsub");
    expect(text).toContain("- Figma — Free Pro plan\n  https://s.test/r/figma");
    expect(text).toContain("Unsubscribe: https://s.test/unsub");
  });

  it("omits an empty section", () => {
    const html = buildDigestHtml({ newThisWeek: content.newThisWeek, closingSoon: [] }, "https://s.test", "u");
    expect(html).not.toContain("Closing in 7 days");
  });
});

describe("unsubscribe tokens", () => {
  it("verifies its own signature only", () => {
    const token = signUnsubscribe("user-1", "secret") as string;
    expect(verifyUnsubscribe("user-1", token, "secret")).toBe(true);
    expect(verifyUnsubscribe("user-2", token, "secret")).toBe(false);
    expect(verifyUnsubscribe("user-1", token, "other")).toBe(false);
    expect(verifyUnsubscribe("user-1", "short", "secret")).toBe(false);
  });

  it("refuses to sign without a secret", () => {
    expect(signUnsubscribe("user-1", null)).toBeNull();
    expect(verifyUnsubscribe("user-1", "anything", null)).toBe(false);
  });

  it("builds the unsubscribe URL", () => {
    expect(unsubscribeUrl("https://s.test", "u 1", "a+b")).toBe("https://s.test/digest/unsubscribe?u=u%201&t=a%2Bb");
  });
});

describe("email sending", () => {
  it("needs both the API key and a sender", () => {
    expect(getEmailConfig({ RESEND_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(
      getEmailConfig({ RESEND_API_KEY: "k", DIGEST_FROM_EMAIL: "a@b.c" } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ apiKey: "k", from: "a@b.c" });
  });

  it("sends in batches of 100 and counts failures without throwing", async () => {
    const emails: OutgoingEmail[] = Array.from({ length: 150 }, (_, i) => ({
      to: `s${i}@x.test`,
      subject: "s",
      html: "h",
      text: "t",
    }));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const result = await sendBatch(emails, { apiKey: "k", from: "a@b.c" }, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toHaveLength(100);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)[0].from).toBe("a@b.c");
    expect(result).toEqual({ sent: 100, failed: 50, errors: ["Resend returned HTTP 500"] });
  });
});
