import { describe, it, expect } from "vitest";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("isSupabaseConfigured", () => {
  it("needs both the project URL and the publishable key", () => {
    expect(
      isSupabaseConfigured(env({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k" })),
    ).toBe(true);
    expect(isSupabaseConfigured(env({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }))).toBe(false);
    expect(isSupabaseConfigured(env({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k" }))).toBe(false);
    expect(isSupabaseConfigured(env({}))).toBe(false);
  });

  it("treats blank values as missing", () => {
    expect(isSupabaseConfigured(env({ NEXT_PUBLIC_SUPABASE_URL: " ", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " " }))).toBe(false);
  });
});
