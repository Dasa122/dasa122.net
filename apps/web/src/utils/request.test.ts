import { describe, expect, test } from "bun:test";
import { resolveOrigin } from "./request";

describe("resolveOrigin", () => {
  test("builds an origin from forwarded headers", () => {
    expect(
      resolveOrigin({
        "x-forwarded-host": "dasa122.net",
        "x-forwarded-proto": "https",
      }),
    ).toBe("https://dasa122.net");
  });

  test("returns null when a header is missing", () => {
    expect(resolveOrigin({ "x-forwarded-host": "dasa122.net" })).toBeNull();
    expect(resolveOrigin({ "x-forwarded-proto": "https" })).toBeNull();
  });
});
