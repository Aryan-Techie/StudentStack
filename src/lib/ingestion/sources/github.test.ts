import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ayushPrograms,
  deepanshuPrograms,
  eduPerks,
  githubStudentPack,
  latestCommitSha,
  mapMonthlyTableRow,
  mapProgramTableRow,
  mapYamlProgram,
  yashisraniPrograms,
} from "./github";

// Network-facing halves of the GitHub list sources: change detection via
// the Commits API and each source's fetch + parse. fetch is stubbed; the
// row mappers' happy paths are in sources.test.ts.
const file = { repo: "owner/list", branch: "main", path: "docs/README.md" };

function respond(body: string, init: ResponseInit = {}) {
  return vi.fn(async () => new Response(body, init));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("latestCommitSha", () => {
  it("asks for the newest commit touching the file", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchImpl = respond(JSON.stringify([{ sha: "abc123" }]));
    expect(await latestCommitSha(file, fetchImpl as unknown as typeof fetch)).toBe("abc123");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/owner/list/commits?path=docs%2FREADME.md&sha=main&per_page=1");
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("sends GITHUB_TOKEN when set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    const fetchImpl = respond("[]");
    expect(await latestCommitSha(file, fetchImpl as unknown as typeof fetch)).toBeNull();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer ghp_test" });
  });

  it("returns null (always refetch) on HTTP errors and network failures", async () => {
    expect(await latestCommitSha(file, respond("", { status: 403 }) as unknown as typeof fetch)).toBeNull();
    const broken = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await latestCommitSha(file, broken as unknown as typeof fetch)).toBeNull();
  });

  it("is what each list source uses as its version", async () => {
    vi.stubGlobal("fetch", respond(JSON.stringify([{ sha: "v1" }])));
    for (const source of [deepanshuPrograms, ayushPrograms, yashisraniPrograms, eduPerks]) {
      expect(await source.version?.()).toBe("v1");
    }
  });
});

describe("table mappers", () => {
  it("skips rows without a link and leaves out empty description parts", () => {
    expect(mapProgramTableRow({ Name: "Plain text" }, "x")).toBeNull();
    const c = mapProgramTableRow({ Name: "[Hacktoberfest](https://hacktoberfest.com)", Stipend: "No", Type: "Event" }, "x");
    expect(c).toMatchObject({ costType: "free", kind: "program", description: "Open-source program." });
  });

  it.each([
    ["Internship", "internship"],
    ["Fellowship", "fellowship"],
    ["Scholarship", "scholarship"],
    ["Mentorship", "mentorship"],
    ["Open Source Event", "program"],
  ])("maps type %s to kind %s", (type, kind) => {
    expect(mapMonthlyTableRow({ Name: "[P](https://p.test)", Type: type })?.kind).toBe(kind);
  });

  it("drops dateless registration and deadline cells", () => {
    const c = mapMonthlyTableRow({
      Name: "[P](https://p.test)",
      "Registration Date Begin (Approximately)": "Before the deadline",
      "Deadline (Approx.)": "-----",
    });
    expect(c?.description).toBe("Open-source program.");
  });
});

describe("mapYamlProgram stipends", () => {
  const base = { name: "Prog", url: "https://p.test" };

  it.each([
    [{ min: 500, max: 500, currency: "USD" }, "$500"],
    [{ min: 10000, max: 20000, currency: "INR" }, "₹10,000–20,000"],
    [{ min: 100, max: 200, currency: "EUR" }, "EUR 100–200"],
    [{ note: "Varies by org" }, "Varies by org"],
  ])("formats %j as %s", (stipend, amount) => {
    const c = mapYamlProgram({ ...base, stipend });
    expect(c).toMatchObject({ amount, costType: "stipend", tagline: `Paid program, ${amount}` });
  });

  it("treats unpaid or missing stipends as free", () => {
    expect(mapYamlProgram({ ...base, stipend: { unpaid: true, min: 1, max: 2 } })).toMatchObject({ amount: null, costType: "free", tagline: null });
    expect(mapYamlProgram({ ...base, stipend: {} })?.amount).toBeNull();
    expect(mapYamlProgram(base)).toMatchObject({ provider: null, description: "Open-source program.", tags: ["Open Source"] });
  });

  it("derives fellowship and mentorship kinds from the name", () => {
    expect(mapYamlProgram({ ...base, name: "MLH Fellowship" })?.kind).toBe("fellowship");
    expect(mapYamlProgram({ ...base, name: "LFX Mentorship" })?.kind).toBe("mentorship");
  });
});

describe("fetchCandidates", () => {
  it("reads every table row from the program list", async () => {
    vi.stubGlobal(
      "fetch",
      respond("| Name | Stipend |\n| --- | --- |\n| [A](https://a.test) | Yes |\n| [B](https://b.test) | No |\n"),
    );
    const rows = await deepanshuPrograms.fetchCandidates();
    expect(rows).toHaveLength(2);
    expect(deepanshuPrograms.mapToCandidate(rows[0])).toMatchObject({ name: "A", costType: "stipend" });
  });

  it("keeps only month-table rows that have a deadline column", async () => {
    vi.stubGlobal(
      "fetch",
      respond(
        [
          "| Name | Other |",
          "| --- | --- |",
          "| [Skip](https://s.test) | x |",
          "",
          "| Name | Deadline (Approx.) |",
          "| --- | --- |",
          "| [Keep](https://k.test) | Mar |",
        ].join("\n"),
      ),
    );
    const rows = await ayushPrograms.fetchCandidates();
    expect(rows).toHaveLength(1);
    expect(ayushPrograms.mapToCandidate(rows[0])?.name).toBe("Keep");
  });

  it("parses the YAML list, tolerating a non-list document", async () => {
    vi.stubGlobal("fetch", respond("- name: GSoC\n  url: https://gsoc.test\n  org: Google\n"));
    const rows = await yashisraniPrograms.fetchCandidates();
    expect(yashisraniPrograms.mapToCandidate(rows[0])).toMatchObject({ name: "GSoC", provider: "Google" });

    vi.stubGlobal("fetch", respond("programs: none\n"));
    expect(await yashisraniPrograms.fetchCandidates()).toEqual([]);
  });

  it("keeps edu perks with a note and maps their section to a category", async () => {
    vi.stubGlobal(
      "fetch",
      respond(
        [
          "## Music & Streaming",
          "### [Spotify](https://spotify.test)",
          "Half-price Premium for students.",
          "## Something else",
          "- [Bare link](https://bare.test)",
          "- [Odd perk](https://odd.test) - Free stuff",
        ].join("\n"),
      ),
    );
    const rows = await eduPerks.fetchCandidates();
    expect(rows).toHaveLength(2);
    expect(eduPerks.mapToCandidate(rows[0])).toMatchObject({ categorySlug: "media-and-entertainment", kind: "perk" });
    // Unknown sections fall back to productivity.
    expect(eduPerks.mapToCandidate(rows[1])?.categorySlug).toBe("productivity");
  });

  it("fetches and parses the Student Pack page", async () => {
    vi.stubGlobal(
      "fetch",
      respond('<div class="pack-offer-card"><h3 id="x">X</h3><h5>Offer</h5><p>Free.</p></div><div class="pack-offer-card">no heading</div>'),
    );
    const cards = await githubStudentPack.fetchCandidates();
    expect(cards).toEqual([{ id: "x", name: "X", about: "", offers: ["Free."] }]);
  });

  it("surfaces HTTP errors from the list host", async () => {
    vi.stubGlobal("fetch", respond("", { status: 404 }));
    await expect(deepanshuPrograms.fetchCandidates()).rejects.toThrow(/HTTP 404/);
  });
});

describe("githubStudentPack.mapToCandidate", () => {
  it("skips partners without a name or offer", () => {
    expect(githubStudentPack.mapToCandidate({ id: "a", name: "", about: "", offers: ["x"] })).toBeNull();
    expect(githubStudentPack.mapToCandidate({ id: "a", name: "A", about: "", offers: [] })).toBeNull();
  });

  it("only uses a short first offer as the tagline", () => {
    const long = "x".repeat(91);
    expect(githubStudentPack.mapToCandidate({ id: "a", name: "A", about: "About A", offers: [long] })).toMatchObject({
      tagline: null,
      description: `About A ${long}`,
    });
  });
});
