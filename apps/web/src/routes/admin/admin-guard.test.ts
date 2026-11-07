import { describe, expect, test } from "bun:test";
import { adminRedirectTarget } from "./admin-guard";

describe("adminRedirectTarget", () => {
  test("points an anonymous visitor at the authentik login with a return path", () => {
    expect(adminRedirectTarget("/admin/news")).toBe(
      "/api/auth/login?returnTo=%2Fadmin%2Fnews",
    );
  });

  test("never allows an absolute or protocol-relative return path", () => {
    expect(adminRedirectTarget("https://evil.example/x")).toBe(
      "/api/auth/login",
    );
    expect(adminRedirectTarget("//evil.example/x")).toBe("/api/auth/login");
  });
});
