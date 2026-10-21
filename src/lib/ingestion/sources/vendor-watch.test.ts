import { describe, it, expect, vi } from "vitest";
import { fingerprint, offerLines, watchSource, WATCHED_PAGES } from "./vendor-watch";

const page = (credit: string) => `<html><head><style>.x{}</style><script>var t = ${Date.now()};</script></head>
<body><nav>Home About Careers</nav>
<h1>Azure for Students</h1>
<p>Get ${credit} in Azure credit for 12 months.</p>
<p>No credit card required.</p>
<li>Free access to popular services.</li>
<footer>© Microsoft. Privacy and cookies.</footer></body></html>`;

describe("offerLines", () => {
  it("keeps sentences about the offer and drops chrome, scripts, and styles", () => {
    const lines = offerLines(page("$100"));
    expect(lines).toContain("Get $100 in Azure credit for 12 months.");
    expect(lines).toContain("Free access to popular services.");
    expect(lines.join(" ")).not.toMatch(/var t|Careers|Privacy/);
  });

  it("changes the fingerprint when the offer changes but not on script noise", () => {
    expect(fingerprint(offerLines(page("$100")))).toBe(fingerprint(offerLines(page("$100"))));
    expect(fingerprint(offerLines(page("$100")))).not.toBe(fingerprint(offerLines(page("$200"))));
  });
});

describe("watchSource", () => {
  it("fetches the page once per run and emits an update candidate for the listed resource", async () => {
    const fetchImpl = vi.fn(async () => new Response(page("$100"), { status: 200 }));
    const source = watchSource(WATCHED_PAGES[1], fetchImpl as unknown as typeof fetch);
    const version = await source.version!();
    const [raw] = await source.fetchCandidates();
    const candidate = source.mapToCandidate(raw);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(source.baselineFirstRun).toBe(true);
    expect(candidate).toMatchObject({ updateOf: "azure-for-students", externalId: `${WATCHED_PAGES[1].url}#${version}` });
    expect(candidate?.description).toContain("$100 in Azure credit");
  });

  it("watches unique resource slugs", () => {
    const slugs = WATCHED_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
