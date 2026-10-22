import { afterEach, describe, expect, it, vi } from "vitest";
import { apifySources, hackathonStart, mapChallengeRow, mapHackathonRow, mapInternshalaRow, mapUnstopRow, runApifyActor } from "./apify";

// Apify runs are billed, so these never hit the network: fetch is stubbed
// and the tests check request shape, caps, and the row filters. The basic
// mapper cases are in sources.test.ts.
function respond(body: unknown, init: ResponseInit = {}) {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body), init));
}

afterEach(() => vi.unstubAllGlobals());

describe("runApifyActor", () => {
  it("POSTs the input to the actor's sync dataset endpoint with the token", async () => {
    const fetchImpl = respond([{ a: 1 }]);
    const rows = await runApifyActor("owner/actor", { maxItems: 3 }, "tok", fetchImpl as unknown as typeof fetch);
    expect(rows).toEqual([{ a: 1 }]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.apify.com/v2/acts/owner~actor/run-sync-get-dataset-items?timeout=110");
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ maxItems: 3 }) });
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("throws on HTTP errors and ignores a non-list body", async () => {
    await expect(runApifyActor("o/a", {}, "t", respond({}, { status: 402 }) as unknown as typeof fetch)).rejects.toThrow(
      "Apify o/a returned HTTP 402",
    );
    expect(await runApifyActor("o/a", {}, "t", respond({ error: "x" }) as unknown as typeof fetch)).toEqual([]);
  });
});

describe("source fetches", () => {
  const byName = (name: string) => {
    const source = apifySources("tok").find((s) => s.name === name);
    if (!source) throw new Error(`missing source ${name}`);
    return source;
  };

  it("runs the challenge actor once per category, filling in the category", async () => {
    const fetchMock = respond([{ title: "T" }]);
    vi.stubGlobal("fetch", fetchMock);
    const rows = (await byName("apify:givemechallenge").fetchCandidates()) as { category: string }[];
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(rows.map((r) => r.category).sort()).toEqual(["Fellowships", "Internships", "Scholarships"]);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(JSON.parse(init.body as string).maxItems).toBe(30);
    }
  });

  it("keeps a category the actor already returned", async () => {
    vi.stubGlobal("fetch", respond([{ title: "T", category: "Scholarships" }]));
    const rows = (await byName("apify:givemechallenge").fetchCandidates()) as { category: string }[];
    expect(rows.every((r) => r.category === "Scholarships")).toBe(true);
  });

  it("runs the hackathon and Unstop actors once each", async () => {
    const fetchMock = respond([{ name: "H" }]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await byName("apify:hackathon-aggregator").fetchCandidates()).toHaveLength(1);
    expect(await byName("apify:unstop").fetchCandidates()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)).toMatchObject({
      opportunityTypes: ["scholarships", "hackathons"],
    });
  });

  it("queries Internshala only for the flagship companies", async () => {
    const fetchMock = respond([]);
    vi.stubGlobal("fetch", fetchMock);
    await byName("apify:internshala-flagship").fetchCandidates();
    const queries = (fetchMock.mock.calls as [string, RequestInit][]).map(([, init]) => JSON.parse(init.body as string).query);
    expect(queries).toEqual(["Microsoft", "Amazon", "Google", "TCS"]);
  });

  it("wires each source to its mapper", () => {
    expect(byName("apify:givemechallenge").mapToCandidate({ title: "S", description: "d", challengeLink: "https://s.test", category: "Fellowships" })).toMatchObject({ kind: "fellowship" });
    expect(byName("apify:hackathon-aggregator").mapToCandidate({ name: "H", url: "https://h.test" })).toMatchObject({ kind: "program" });
    expect(byName("apify:unstop").mapToCandidate({ title: "S", url: "https://u.test", opportunityType: "scholarships" })).toMatchObject({ kind: "scholarship" });
    expect(byName("apify:internshala-flagship").mapToCandidate({ title: "Intern", company: "Google", sourceUrl: "https://i.test" })).toMatchObject({ kind: "internship" });
  });
});

describe("mapChallengeRow", () => {
  const row = { title: "Intern", description: "Paid summer role.", challengeLink: "https://c.test", category: "Internships" };

  it("pays internships as stipends and parses only valid deadlines", () => {
    expect(mapChallengeRow({ ...row, deadline: "not a date" })).toMatchObject({ costType: "stipend", deadline: null, amount: null });
    expect(mapChallengeRow({ ...row, deadline: "  " })?.deadline).toBeNull();
  });

  it("requires a title, link, category, and description", () => {
    expect(mapChallengeRow({ ...row, category: undefined })).toBeNull();
    expect(mapChallengeRow({ ...row, title: "" })).toBeNull();
    expect(mapChallengeRow({ ...row, description: "   " })).toBeNull();
  });

  it("clips long descriptions with an ellipsis", () => {
    const c = mapChallengeRow({ ...row, description: "word ".repeat(200) });
    expect(c?.description.length).toBeLessThanOrEqual(600);
    expect(c?.description.endsWith("…")).toBe(true);
  });
});

describe("mapHackathonRow", () => {
  it("names ETHGlobal and passes other platforms through", () => {
    expect(mapHackathonRow({ name: "E", url: "https://e.test", source: "ethglobal", focus: ["DeFi", "ZK", "AI", "Extra"], prize: "$10k" })).toMatchObject({
      provider: "ETHGlobal",
      tags: ["Hackathon", "DeFi", "ZK", "AI"],
      amount: "$10k",
      description: "Hackathon on ETHGlobal. Themes: DeFi, ZK, AI.",
    });
    expect(mapHackathonRow({ name: "M", url: "https://m.test", source: "mlh" })?.provider).toBe("mlh");
    expect(mapHackathonRow({ name: "N", url: "https://n.test" })).toMatchObject({ provider: null, description: "Hackathon." });
  });

  it("returns no deadline for unparseable dates", () => {
    expect(hackathonStart(undefined)).toBeNull();
    expect(hackathonStart("TBA")).toBeNull();
    expect(hackathonStart("Foo 10 - 12, 2026")).toBeNull();
  });
});

describe("mapUnstopRow", () => {
  const row = { title: "Merit Scholarship", opportunityType: "scholarships", url: "https://unstop.com/s", organizer: "Org", eligibility: ["UG", "PG"], tags: ["a", "b", "c", "d"], prize: "₹50,000" };

  it("describes scholarships with organizer and eligibility", () => {
    expect(mapUnstopRow(row)).toMatchObject({
      externalId: "https://unstop.com/s",
      categorySlug: "learning-and-education",
      costType: "scholarship",
      description: "Scholarship listed on Unstop, by Org. Open to: UG, PG.",
      tags: ["Scholarship", "a", "b", "c"],
      amount: "₹50,000",
      provider: "Org",
    });
  });

  it("skips closed listings and rows missing a title or URL", () => {
    expect(mapUnstopRow({ ...row, status: "expired" })).toBeNull();
    expect(mapUnstopRow({ ...row, title: undefined })).toBeNull();
    expect(mapUnstopRow({ ...row, url: undefined })).toBeNull();
  });
});

describe("mapInternshalaRow", () => {
  const row = { title: "SDE Intern", company: "Amazon", applyUrl: "https://internshala.com/apply/1" };

  it("falls back to the apply URL and a generated description", () => {
    expect(mapInternshalaRow({ ...row, isWorkFromHome: true })).toMatchObject({
      externalId: "https://internshala.com/apply/1",
      url: "https://internshala.com/apply/1",
      description: "Internship at Amazon, listed on Internshala.",
      tags: ["Internship", "Remote"],
      amount: null,
    });
  });

  it("skips non-internship listings and rows without a URL", () => {
    expect(mapInternshalaRow({ ...row, listingType: "job" })).toBeNull();
    expect(mapInternshalaRow({ ...row, applyUrl: undefined })).toBeNull();
    expect(mapInternshalaRow({ ...row, company: undefined })).toBeNull();
  });
});
