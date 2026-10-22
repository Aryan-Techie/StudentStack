import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProfile, profileToEligibility, type Profile } from "@/lib/profiles";
import { GET } from "./route";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/profiles", () => ({ getProfile: vi.fn(), profileToEligibility: vi.fn() }));

const signedOutBody = { signedIn: false, profile: null, eligibility: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/profile", () => {
  it("answers signed out when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(await (await GET()).json()).toEqual(signedOutBody);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("answers signed out without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(await res.json()).toEqual(signedOutBody);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns only branch and year plus the derived eligibility", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const profile = { userId: "user-1", branch: "CSE", year: 2, calendarToken: "secret" } as Profile;
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(profileToEligibility).mockReturnValue({ country: "IN", field: "CSE", year: 2 });
    const body = await (await GET()).json();
    expect(body).toEqual({
      signedIn: true,
      profile: { branch: "CSE", year: 2 },
      eligibility: { country: "IN", field: "CSE", year: 2 },
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(profileToEligibility).toHaveBeenCalledWith(profile);
  });

  it("handles a user with no profile row yet", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.mocked(getProfile).mockResolvedValue(null);
    vi.mocked(profileToEligibility).mockReturnValue(null);
    expect(await (await GET()).json()).toEqual({ signedIn: true, profile: null, eligibility: null });
  });

  it("stays signed in with an empty profile when the lookup fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.mocked(getProfile).mockRejectedValue("db down");
    expect(await (await GET()).json()).toEqual({ signedIn: true, profile: null, eligibility: null });
    expect(console.warn).toHaveBeenCalledWith("[profile] load failed:", "db down");
  });
});
