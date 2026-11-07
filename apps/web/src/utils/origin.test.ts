import { describe, expect, test } from "bun:test";
import { fallbackApiOrigin, resolveOrigin } from "./origin";

describe("fallbackApiOrigin", () => {
  test("is an absolute origin", () => {
    expect(fallbackApiOrigin).toMatch(/^https?:\/\/[^/]+$/);
  });
});

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

  test("returns null when a header is empty", () => {
    expect(
      resolveOrigin({
        "x-forwarded-host": "",
        "x-forwarded-proto": "https",
      }),
    ).toBeNull();
  });

  test("takes the first value of a chained header", () => {
    expect(
      resolveOrigin({
        "x-forwarded-host": "dasa122.net, internal:3000",
        "x-forwarded-proto": "https, http",
      }),
    ).toBe("https://dasa122.net");
  });
});
