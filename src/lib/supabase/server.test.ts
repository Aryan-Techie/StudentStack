import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabaseClient } from "./server";

const cookieStore = { getAll: vi.fn(), set: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ auth: {} })) }));

type CookieMethods = {
  getAll: () => unknown;
  setAll: (cookies: { name: string; value: string; options: object }[]) => void;
};

function cookieMethods(): CookieMethods {
  return (vi.mocked(createServerClient).mock.calls[0][2] as unknown as { cookies: CookieMethods }).cookies;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk_test");
});

afterEach(() => vi.unstubAllEnvs());

describe("createServerSupabaseClient", () => {
  it("creates a client for the configured project", async () => {
    await createServerSupabaseClient();
    expect(createServerClient).toHaveBeenCalledWith("https://project.supabase.co", "pk_test", expect.any(Object));
  });

  it("reads and writes session cookies through Next's cookie store", async () => {
    cookieStore.getAll.mockReturnValue([{ name: "sb", value: "1" }]);
    await createServerSupabaseClient();
    const { getAll, setAll } = cookieMethods();
    expect(getAll()).toEqual([{ name: "sb", value: "1" }]);
    setAll([
      { name: "a", value: "1", options: { path: "/" } },
      { name: "b", value: "2", options: {} },
    ]);
    expect(cookieStore.set).toHaveBeenCalledWith("a", "1", { path: "/" });
    expect(cookieStore.set).toHaveBeenCalledWith("b", "2", {});
  });

  it("ignores cookie writes during a Server Component render", async () => {
    cookieStore.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
    await createServerSupabaseClient();
    expect(() => cookieMethods().setAll([{ name: "a", value: "1", options: {} }])).not.toThrow();
  });
});
