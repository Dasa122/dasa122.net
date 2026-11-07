import { describe, expect, test } from "bun:test";
import { requireAdmin } from "./auth";

const context = (session: unknown) =>
  ({
    db: null,
    now: new Date(),
    request: new Request("https://dasa122.net/api/rpc"),
    session,
  }) as never;

describe("requireAdmin", () => {
  test("throws UNAUTHORIZED without a session", () => {
    expect(() => requireAdmin(context(null))).toThrow();
  });

  test("throws FORBIDDEN for a session without the admin group", () => {
    expect(() =>
      requireAdmin(
        context({
          email: null,
          expiresAt: new Date(),
          groups: ["other"],
          id: "x",
          name: null,
          subject: "u",
        }),
      ),
    ).toThrow();
  });
});
