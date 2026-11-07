import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/client";
import { adminRedirectTarget, classifyAdminError } from "./admin-guard";

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

  test("never allows a backslash or a control character in the return path", () => {
    expect(adminRedirectTarget("/\\evil.example/x")).toBe("/api/auth/login");
    expect(adminRedirectTarget("/admin/\nnews")).toBe("/api/auth/login");
  });
});

describe("classifyAdminError", () => {
  test("treats FORBIDDEN as a signed-in user without the admin group", () => {
    expect(
      classifyAdminError(
        new ORPCError("FORBIDDEN", { message: "Admin group required" }),
      ),
    ).toBe("forbidden");
  });

  test("treats UNAUTHORIZED as an anonymous visitor", () => {
    expect(
      classifyAdminError(
        new ORPCError("UNAUTHORIZED", { message: "Authentication required" }),
      ),
    ).toBe("unauthorized");
  });

  test("treats anything else as not an auth decision", () => {
    expect(classifyAdminError(new Error("boom"))).toBe("other");
    expect(classifyAdminError({ code: "NOT_FOUND" })).toBe("other");
  });
});
