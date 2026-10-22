import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBookmarkStatuses } from "@/lib/bookmarks";
import { GET } from "./route";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/bookmarks", () => ({ getBookmarkStatuses: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/bookmarks", () => {
  it("answers signed out when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await GET();
    expect(await res.json()).toEqual({ signedIn: false, bookmarks: {} });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("answers signed out without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(await res.json()).toEqual({ signedIn: false, bookmarks: {} });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns the session user's statuses, never cached", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.mocked(getBookmarkStatuses).mockResolvedValue({ 3: "applied" });
    const res = await GET();
    expect(await res.json()).toEqual({ signedIn: true, bookmarks: { 3: "applied" } });
    expect(getBookmarkStatuses).toHaveBeenCalledWith("user-1");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("stays signed in with no bookmarks when the lookup fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.mocked(getBookmarkStatuses).mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(await res.json()).toEqual({ signedIn: true, bookmarks: {} });
    expect(console.warn).toHaveBeenCalledWith("[bookmarks] load failed:", "db down");
  });
});
