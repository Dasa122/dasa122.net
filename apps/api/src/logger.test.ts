import { describe, expect, test } from "bun:test";
import { redact } from "./logger";

describe("redact", () => {
  test("replaces secret-bearing keys with [redacted]", () => {
    const result = redact({
      accessToken: "tok_123",
      clientSecret: "super-secret",
      codeVerifier: "verifier_abc",
      password: "hunter2",
      title: "a normal post title",
    }) as Record<string, unknown>;
    expect(result.clientSecret).toBe("[redacted]");
    expect(result.accessToken).toBe("[redacted]");
    expect(result.codeVerifier).toBe("[redacted]");
    expect(result.password).toBe("[redacted]");
    expect(result.title).toBe("a normal post title");
  });

  test("redacts nested objects and arrays", () => {
    const result = redact({
      list: [{ token: "z" }],
      outer: { clientSecret: "x", keep: "y" },
    }) as {
      outer: { clientSecret: string; keep: string };
      list: { token: string }[];
    };
    expect(result.outer.clientSecret).toBe("[redacted]");
    expect(result.outer.keep).toBe("y");
    expect(result.list[0]?.token).toBe("[redacted]");
  });
});
