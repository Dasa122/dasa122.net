import { describe, expect, test } from "bun:test";
import { assertSameOrigin } from "./csrf";

const PUBLIC_ORIGIN = "https://dasa122.net";

// `app.ts` validates the environment at module load, so set a complete bag and
// the service token before importing the dispatcher.
process.env.AUTH_DEV_BYPASS = "false";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/dasa122_net";
process.env.PUBLIC_ORIGIN = PUBLIC_ORIGIN;
process.env.AUTHENTIK_ISSUER ??= "https://auth.dasa122.net/application/o/demo/";
process.env.MCP_TOKEN = "test-token-123";

const { handleRequest } = await import("../app");

function request(method: string, origin?: string, bearer?: string): Request {
  const headers = new Headers();
  if (origin !== undefined) {
    headers.set("origin", origin);
  }
  if (bearer !== undefined) {
    headers.set("authorization", `Bearer ${bearer}`);
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

describe("the CSRF guard through the request dispatch", () => {
  test("a valid bearer does not bypass a cross-origin check", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/auth/logout", {
        headers: {
          authorization: "Bearer test-token-123",
          origin: "https://evil.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
  });

  test("the same bearer request without an Origin passes CSRF", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/auth/logout", {
        headers: { authorization: "Bearer test-token-123" },
        method: "POST",
      }),
    );

    // Past the guard, logout clears the cookie and redirects.
    expect(response.status).toBe(302);
  });
});
