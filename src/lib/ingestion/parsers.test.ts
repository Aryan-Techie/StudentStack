import { describe, it, expect } from "vitest";
import { decodeEntities, extractDeadline, parseRssItems } from "./rss";
import { cleanText, firstLink, parseLinkList, parseMarkdownTables } from "./markdown";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("parseRssItems", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>Feed</title>
    <item>
      <title><![CDATA[Chevening Scholarships 2027 &amp; more]]></title>
      <link>https://example.org/chevening</link>
      <guid isPermaLink="false">post-1</guid>
      <description><![CDATA[<p>Fully funded. <strong>Deadline:</strong> 4 November 2026</p>]]></description>
      <category>UK</category><category><![CDATA[Masters]]></category>
      <pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate>
    </item>
    <item><title>No link</title></item>
  </channel></rss>`;

  it("parses items, CDATA, entities, and categories", () => {
    const items = parseRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Chevening Scholarships 2027 & more",
      link: "https://example.org/chevening",
      guid: "post-1",
      categories: ["UK", "Masters"],
      pubDate: "Mon, 12 Oct 2026 10:00:00 GMT",
    });
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("&#8211; &#x2014; &nbsp;x")).toBe("– —  x");
  });
});

describe("extractDeadline", () => {
  it.each([
    ["Deadline: 4 November 2026", "2026-11-04"],
    ["Applications close on March 15, 2027.", "2027-03-15"],
    ["Apply by 2026-12-01 at noon", "2026-12-01"],
    ["Last date: 15/01/2027", "2027-01-15"],
    ["Published 1 June 2026. Deadline is 30th September 2026", "2026-09-30"],
  ])("%s", (text, expected) => {
    expect(iso(extractDeadline(text))).toBe(expected);
  });

  it("rejects impossible dates and text without dates", () => {
    expect(extractDeadline("Deadline: 30 February 2027")).toBeNull();
    expect(extractDeadline("Rolling admissions")).toBeNull();
  });
});

describe("parseMarkdownTables", () => {
  const md = `Intro

| Name | Stipend | Timeline |
|------|---------|----------|
| [Google Summer of Code (GSoC)](https://summerofcode.withgoogle.com/) | Yes | Feb-Nov annually |
| [MLH Fellowship](https://fellowship.mlh.io/) | Yes |

Text between

|:-----|:--------|
| a | b |
`;

  it("reads every table row keyed by header, padding short rows", () => {
    const tables = parseMarkdownTables(md);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toHaveLength(2);
    expect(tables[0][0].Stipend).toBe("Yes");
    expect(tables[0][1].Timeline).toBe("");
    expect(firstLink(tables[0][0].Name)).toEqual({ text: "Google Summer of Code (GSoC)", url: "https://summerofcode.withgoogle.com/" });
  });

  it("cleans badges, stars, and links from cells", () => {
    expect(cleanText("⭐ [MLH](https://x.test) ![b](https://img.test/b.svg) **new**")).toBe("MLH new");
  });
});

describe("parseLinkList", () => {
  const md = `# Perks

- [Software](#software)

## Software & Productivity Tools

### [Figma for Education](https://www.figma.com/education/)

Free Figma Professional for students.

## Food & Dining

- [Chipotle](https://chipotle.com/students) — Free chips with a student ID.
`;

  it("reads heading entries and bullet entries with their section", () => {
    expect(parseLinkList(md)).toEqual([
      {
        text: "Figma for Education",
        url: "https://www.figma.com/education/",
        note: "Free Figma Professional for students.",
        section: "Software & Productivity Tools",
      },
      { text: "Chipotle", url: "https://chipotle.com/students", note: "Free chips with a student ID.", section: "Food & Dining" },
    ]);
  });
});
