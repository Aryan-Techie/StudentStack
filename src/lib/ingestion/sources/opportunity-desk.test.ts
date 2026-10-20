import { extractDeadline, mapOpportunityDeskItem, parseRssItems } from "./opportunity-desk";

describe("extractDeadline", () => {
  it("parses day-month-year with month name", () => {
    expect(extractDeadline("Deadline: 15 March 2026")).toBe("2026-03-15");
    expect(extractDeadline("Apply by 2nd February 2025")).toBe("2025-02-02");
  });

  it("parses month-day-year", () => {
    expect(extractDeadline("Deadline: March 15, 2026")).toBe("2026-03-15");
    expect(extractDeadline("closing date: december 1 2025")).toBe("2025-12-01");
  });

  it("parses ISO and day-first slash dates", () => {
    expect(extractDeadline("Deadline: 2026-12-01")).toBe("2026-12-01");
    expect(extractDeadline("Deadline: 31/01/2026")).toBe("2026-01-31");
  });

  it("returns null when there is no (valid) deadline", () => {
    expect(extractDeadline("no date here")).toBeNull();
    expect(extractDeadline("Deadline: 32 January 2026")).toBeNull();
    expect(extractDeadline("Deadline: February 30, 2026")).toBeNull();
    expect(extractDeadline("Deadline: Someday")).toBeNull();
  });
});

describe("parseRssItems", () => {
  const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item>
<title><![CDATA[DAAD Scholarship 2026]]></title>
<link>https://opportunitydesk.org/daad-2026/</link>
<guid>https://opportunitydesk.org/daad-2026/</guid>
<description><![CDATA[<p>Fully funded. <strong>Deadline: 15 October 2026</strong></p>]]></description>
<pubDate>Mon, 01 Sep 2025 10:00:00 +0000</pubDate>
</item>
<item><link>https://opportunitydesk.org/no-title/</link></item>
</channel></rss>`;

  it("extracts items and skips title-less ones", () => {
    const items = parseRssItems(rss);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("DAAD Scholarship 2026");
    expect(items[0].link).toBe("https://opportunitydesk.org/daad-2026/");
  });
});

describe("mapOpportunityDeskItem", () => {
  it("maps a feed item to candidate fields with a deadline", () => {
    const c = mapOpportunityDeskItem({
      title: "DAAD Scholarship 2026",
      link: "https://opportunitydesk.org/daad-2026/",
      guid: "https://opportunitydesk.org/daad-2026/",
      description: "<p>Fully funded. Deadline: 15 October 2026</p>",
    });
    expect(c).toMatchObject({
      name: "DAAD Scholarship 2026",
      url: "https://opportunitydesk.org/daad-2026/",
      externalId: "https://opportunitydesk.org/daad-2026/",
      deadline: new Date("2026-10-15T00:00:00.000Z"),
    });
    expect(c!.description).not.toContain("<p>");
  });

  it("returns null without a title", () => {
    expect(mapOpportunityDeskItem({ link: "https://x.test/" })).toBeNull();
    expect(mapOpportunityDeskItem({})).toBeNull();
  });

  it("leaves deadline null when the text has none", () => {
    const c = mapOpportunityDeskItem({ title: "Some Contest", link: "https://x.test/" });
    expect(c!.deadline).toBeNull();
  });
});
