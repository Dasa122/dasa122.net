import { describe, expect, spyOn, test } from "bun:test";
import { logger, redact } from "./logger";

/** Runs `emit` with stdout captured and returns the lines it wrote. */
function capture(run: () => void): string[] {
  const spy = spyOn(process.stdout, "write").mockImplementation(() => true);
  let lines: string[] = [];
  try {
    run();
  } finally {
    lines = spy.mock.calls.map((call) => String(call[0]));
    spy.mockRestore();
  }
  return lines;
}

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

  test("replaces a cycle with [circular] instead of recursing forever", () => {
    const node: Record<string, unknown> = { label: "root" };
    node.self = node;
    const result = redact(node) as Record<string, unknown>;
    expect(result.label).toBe("root");
    expect(result.self).toBe("[circular]");
  });
});

describe("logger", () => {
  test("a self-referential payload produces a log line and does not throw", () => {
    const node: Record<string, unknown> = { label: "root" };
    node.self = node;
    const lines = capture(() => logger.info({ node }, "cyclic payload"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[circular]");
    expect(lines[0]).toContain("cyclic payload");
  });

  test("a BigInt payload falls back to log_serialization_failed", () => {
    const lines = capture(() => logger.info({ count: 10n }, "bigint payload"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("log_serialization_failed");
  });
});
