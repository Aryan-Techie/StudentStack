import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { saveEligibility, saveProfile } from "@/lib/profiles";
import { completeOnboarding, syncEligibility } from "./actions";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/profiles", () => ({ saveEligibility: vi.fn(), saveProfile: vi.fn() }));
// Like Next's redirect(), stop the action at the call.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("completeOnboarding", () => {
  it("sends a signed-out caller to /my-list without saving", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(completeOnboarding(form({ branch: "CSE" }))).rejects.toThrow("NEXT_REDIRECT:/my-list");
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("saves a known branch and year, then follows a same-site next", async () => {
    await expect(completeOnboarding(form({ branch: "CSE", year: "3", next: "/deadlines" }))).rejects.toThrow(
      "NEXT_REDIRECT:/deadlines",
    );
    expect(saveProfile).toHaveBeenCalledWith("user-1", { branch: "CSE", year: 3 });
  });

  it("drops unknown values and an off-site next", async () => {
    await expect(
      completeOnboarding(form({ branch: "Astrology", year: "9", next: "https://evil.example" })),
    ).rejects.toThrow("NEXT_REDIRECT:/directory");
    expect(saveProfile).toHaveBeenCalledWith("user-1", { branch: null, year: null });
  });

  it("still marks onboarding done when skipped", async () => {
    await expect(completeOnboarding(form({ skip: "1", branch: "CSE", year: "2" }))).rejects.toThrow(
      "NEXT_REDIRECT:/directory",
    );
    expect(saveProfile).toHaveBeenCalledWith("user-1", { branch: null, year: null });
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});

describe("syncEligibility", () => {
  it("refuses signed-out callers and malformed profiles", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await syncEligibility({ country: "IN" })).toEqual({ ok: false });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    expect(await syncEligibility("not an object")).toEqual({ ok: false });
    expect(saveEligibility).not.toHaveBeenCalled();
  });

  it("saves the parsed profile, not the raw input", async () => {
    expect(await syncEligibility({ country: "us", level: "UG", isAdmin: true })).toEqual({ ok: true });
    expect(saveEligibility).toHaveBeenCalledWith("user-1", { country: "US", level: "UG" });
  });

  it("reports a failed save", async () => {
    vi.mocked(saveEligibility).mockRejectedValueOnce(new Error("db down"));
    expect(await syncEligibility({ country: "IN" })).toEqual({ ok: false });
    expect(console.warn).toHaveBeenCalledWith("[profile] eligibility sync failed:", "db down");
  });
});
