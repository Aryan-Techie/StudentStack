import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getResourceBySlug } from "@/lib/resources";

vi.mock("@/lib/resources", () => ({ getResourceBySlug: vi.fn() }));
const mockGet = vi.mocked(getResourceBySlug);

function get(slug: string) {
  return GET(new Request(`http://localhost/api/resources/${slug}`), { params: Promise.resolve({ id: slug }) });
}

describe("GET /api/resources/{slug}", () => {
  it("returns the resource with CDN cache headers", async () => {
    mockGet.mockResolvedValue({ id: 1, slug: "figma", name: "Figma" } as Awaited<ReturnType<typeof getResourceBySlug>>);
    const res = await get("figma");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
    expect((await res.json()).name).toBe("Figma");
  });

  it("returns 404 for unknown slugs", async () => {
    mockGet.mockResolvedValue(null);
    expect((await get("nope")).status).toBe(404);
  });

  it("returns 404 without querying for malformed slugs", async () => {
    mockGet.mockClear();
    expect((await get("Bad%20Slug")).status).toBe(404);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
