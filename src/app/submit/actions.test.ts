import { beforeEach, describe, expect, it, vi } from "vitest";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fakeDb } from "@/test/fake-db";
import { countPendingByUser, getCategories, isUrlListed } from "@/lib/resources";
import { assertPublicUrl } from "@/lib/ssrf";
import { notifyNewSubmission } from "@/lib/admin-notify";
import { signInWithEmail, signInWithGoogle, signOut, submitResource, type SubmitState } from "./actions";

const auth = {
  getUser: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ auth }) }));

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/db", async () => {
  const { fakeDb } = await import("@/test/fake-db");
  return { db: fakeDb.db, schema: await import("@/db/schema") };
});
vi.mock("@/lib/resources", () => ({
  countPendingByUser: vi.fn(),
  getCategories: vi.fn(),
  isUrlListed: vi.fn(),
}));
vi.mock("@/lib/ssrf", () => ({ assertPublicUrl: vi.fn() }));
vi.mock("@/lib/admin-notify", () => ({ notifyNewSubmission: vi.fn() }));

const idle: SubmitState = { status: "idle" };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validOffer = {
  name: "Figma Education",
  url: "https://figma.com/education",
  tagline: "Free Professional plan",
  description: "Verified students get the Professional plan for free.",
  categoryId: "3",
  costType: "free",
  region: "Global",
  credit: "Asha",
};

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb.reset();
  requestHeaders.current = new Headers({ origin: "https://studentstack.test" });
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  vi.mocked(getCategories).mockResolvedValue([{ id: 3, slug: "design-and-creative", name: "Design & Creative", icon: "d" }]);
  vi.mocked(assertPublicUrl).mockResolvedValue("https://figma.com/education");
  vi.mocked(countPendingByUser).mockResolvedValue(0);
  vi.mocked(isUrlListed).mockResolvedValue(false);
});

describe("signInWithEmail", () => {
  it.each(["", "not-an-email", `${"a".repeat(250)}@x.io`])("rejects %j before calling Supabase", async (email) => {
    const state = await signInWithEmail(idle as never, form({ email }));
    expect(state.status).toBe("error");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a magic link back to the request's origin, keeping a same-site next", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    const state = await signInWithEmail(idle as never, form({ email: " me@uni.edu ", next: "/my-list?tab=saved" }));
    expect(state).toEqual({ status: "sent", email: "me@uni.edu" });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "me@uni.edu",
      options: { emailRedirectTo: "https://studentstack.test/auth/callback?next=%2Fmy-list%3Ftab%3Dsaved" },
    });
  });

  it("builds the origin from forwarded headers when Origin is absent", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-host": "preview.example", host: "internal:3000" });
    auth.signInWithOtp.mockResolvedValue({ error: null });
    await signInWithEmail(idle as never, form({ email: "me@uni.edu", next: "//evil.example" }));
    expect(auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://preview.example/auth/callback?next=%2Fsubmit",
    );
  });

  it("explains rate limiting separately from other failures", async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 429 } });
    const limited = await signInWithEmail(idle as never, form({ email: "me@uni.edu" }));
    expect(limited).toMatchObject({ status: "error", email: "me@uni.edu" });
    expect(limited.message).toMatch(/wait a minute/i);

    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 500 } });
    const failed = await signInWithEmail(idle as never, form({ email: "me@uni.edu" }));
    expect(failed.message).not.toBe(limited.message);
  });
});

describe("signInWithGoogle", () => {
  it("redirects to the provider URL", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.test/o" }, error: null });
    await expect(signInWithGoogle(form({ next: "/my-list" }))).rejects.toThrow(
      "NEXT_REDIRECT:https://accounts.google.test/o",
    );
    expect(auth.signInWithOAuth.mock.calls[0][0]).toMatchObject({ provider: "google" });
  });

  it("returns to the starting page with an error flag on failure", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error("nope") });
    await expect(signInWithGoogle(form({ next: "/my-list?x=1" }))).rejects.toThrow("NEXT_REDIRECT:/my-list?error=google");
  });
});

describe("signOut", () => {
  it("signs out and returns to a same-site path", async () => {
    await expect(signOut(form({ next: "/directory" }))).rejects.toThrow("NEXT_REDIRECT:/directory");
    expect(auth.signOut).toHaveBeenCalled();
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/submit");
  });
});

describe("submitResource", () => {
  it("requires a session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    const state = await submitResource(idle, form(validOffer));
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/sign-in expired/);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("returns field errors and echoes the values back", async () => {
    const state = await submitResource(idle, form({ ...validOffer, name: "", categoryId: "999" }));
    expect(state.status).toBe("error");
    expect(Object.keys(state.errors ?? {}).sort()).toEqual(["categoryId", "name"]);
    expect(state.values?.url).toBe(validOffer.url);
    expect(assertPublicUrl).not.toHaveBeenCalled();
  });

  it("rejects a link that doesn't resolve to a public address", async () => {
    vi.mocked(assertPublicUrl).mockRejectedValue(new Error("private address"));
    const state = await submitResource(idle, form(validOffer));
    expect(state.errors?.url).toMatch(/public website/);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("caps pending submissions per student", async () => {
    vi.mocked(countPendingByUser).mockResolvedValue(5);
    const state = await submitResource(idle, form(validOffer));
    expect(state.message).toMatch(/5 offers waiting for review/);
    expect(countPendingByUser).toHaveBeenCalledWith("user-1");
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("rejects a link that's already listed", async () => {
    vi.mocked(isUrlListed).mockResolvedValue(true);
    const state = await submitResource(idle, form(validOffer));
    expect(state.errors?.url).toMatch(/already in the directory/);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("inserts an unapproved row credited to the session user", async () => {
    const state = await submitResource(idle, form(validOffer));
    expect(state).toEqual({ status: "success", submittedName: "Figma Education" });

    const row = fakeDb.call(0, "values")?.args[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      name: "Figma Education",
      url: "https://figma.com/education",
      categoryId: 3,
      costType: "free",
      region: "Global",
      approved: false,
      submittedBy: "user-1",
      contributorCredit: "Asha",
    });
    expect(row.slug).toMatch(/^figma-education-[0-9a-f-]{6}$/);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/submit");
  });

  it("notifies the admin after the response", async () => {
    await submitResource(idle, form(validOffer));
    expect(notifyNewSubmission).not.toHaveBeenCalled();

    const task = vi.mocked(after).mock.calls[0][0] as () => Promise<void>;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(notifyNewSubmission).mockResolvedValue({ sent: false, reason: "no webhook" } as never);
    await task();
    expect(notifyNewSubmission).toHaveBeenCalledWith(
      { name: "Figma Education", url: "https://figma.com/education", categoryName: "Design & Creative" },
      expect.stringMatching(/\/admin$/),
    );
    expect(log).toHaveBeenCalledWith("[submit] admin notification skipped: no webhook");
    log.mockRestore();
  });
});
