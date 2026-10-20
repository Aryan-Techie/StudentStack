import { describe, it, expect } from "vitest";
import { adminEmails, isAdmin } from "@/lib/admin/roles";

const env = (ADMIN_EMAIL?: string) => ({ ADMIN_EMAIL }) as unknown as NodeJS.ProcessEnv;

describe("adminEmails", () => {
  it("keeps a single address working and accepts a comma-separated list", () => {
    expect([...adminEmails(env("admin@x.test"))]).toEqual(["admin@x.test"]);
    expect([...adminEmails(env(" A@x.test , b@y.test,, "))]).toEqual(["a@x.test", "b@y.test"]);
    expect(adminEmails(env(undefined)).size).toBe(0);
  });
});

describe("isAdmin", () => {
  it("accepts listed emails case-insensitively", () => {
    expect(isAdmin({ email: "Admin@X.test" }, env("admin@x.test"))).toBe(true);
  });

  it("accepts the admin role without a listed email", () => {
    expect(isAdmin({ email: "mod@x.test", role: "admin" }, env("admin@x.test"))).toBe(true);
  });

  it("rejects everyone else, including an empty ADMIN_EMAIL", () => {
    expect(isAdmin({ email: "student@x.test", role: "student" }, env("admin@x.test"))).toBe(false);
    expect(isAdmin({ email: null }, env(""))).toBe(false);
    expect(isAdmin({ email: "" }, env(""))).toBe(false);
  });
});
