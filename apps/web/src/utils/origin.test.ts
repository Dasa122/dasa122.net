import { describe, expect, test } from "bun:test";
import {
  fallbackApiOrigin,
  resolveFallbackOrigin,
  resolveOrigin,
} from "./origin";

describe("fallbackApiOrigin", () => {
  test("is an absolute origin", () => {
    expect(fallbackApiOrigin).toMatch(/^https?:\/\/[^/]+$/);
  });
});

describe("resolveFallbackOrigin", () => {
  test("defaults to localhost in development", () => {
    expect(resolveFallbackOrigin(undefined, true)).toBe(
      "http://localhost:3001",
    );
  });

  test("defaults to the public site in a production build", () => {
    expect(resolveFallbackOrigin(undefined, false)).toBe("https://dasa122.net");
  });

  test("an empty configured value falls through to the environment default", () => {
    expect(resolveFallbackOrigin("", true)).toBe("http://localhost:3001");
    expect(resolveFallbackOrigin("", false)).toBe("https://dasa122.net");
  });

  test("a configured value wins in either environment", () => {
    expect(resolveFallbackOrigin("https://api.example.com", true)).toBe(
      "https://api.example.com",
    );
    expect(resolveFallbackOrigin("https://api.example.com", false)).toBe(
      "https://api.example.com",
    );
  });

  test("normalises a trailing path to an origin", () => {
    expect(resolveFallbackOrigin("http://localhost:3001/api", true)).toBe(
      "http://localhost:3001",
    );
  });

  test("throws on an unparseable value", () => {
    expect(() => resolveFallbackOrigin("not a url", true)).toThrow();
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
