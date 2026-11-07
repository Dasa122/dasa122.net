import { describe, expect, test } from "bun:test";
import { assertSameOrigin } from "./csrf";

const PUBLIC_ORIGIN = "https://dasa122.net";

function request(method: string, origin?: string): Request {
  const headers = new Headers();
  if (origin !== undefined) {
    headers.set("origin", origin);
  }
  return new Request("https://dasa122.net/api/rpc", { headers, method });
}

describe("assertSameOrigin", () => {
  test("an equal origin passes", () => {
    expect(() =>
      assertSameOrigin(request("POST", PUBLIC_ORIGIN), PUBLIC_ORIGIN),
    ).not.toThrow();
  });

  test("a different origin throws", () => {
    expect(() =>
      assertSameOrigin(request("POST", "https://evil.example"), PUBLIC_ORIGIN),
    ).toThrow();
  });

  test("an absent Origin header is allowed", () => {
    expect(() =>
      assertSameOrigin(request("POST"), PUBLIC_ORIGIN),
    ).not.toThrow();
  });

  test("a GET is skipped regardless of origin", () => {
    expect(() =>
      assertSameOrigin(request("GET", "https://evil.example"), PUBLIC_ORIGIN),
    ).not.toThrow();
  });
});
