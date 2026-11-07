import { describe, expect, test } from "bun:test";
import {
  buildAuthorizeUrl,
  discover,
  exchangeCode,
  type OidcDiscovery,
  parseTokenErrorBody,
} from "./oidc";

const discovery: OidcDiscovery = {
  authorization_endpoint: "https://auth.example/application/o/demo/authorize",
  issuer: "https://auth.example/application/o/demo/",
  jwks_uri: "https://auth.example/application/o/demo/jwks",
  token_endpoint: "https://auth.example/application/o/demo/token",
};

const exchangeArgs = {
  clientId: "client-id",
  clientSecret: "client-secret",
  code: "code-1",
  codeVerifier: "verifier-1",
  discovery,
  redirectUri: "https://dasa122.net/api/auth/callback",
};

type Captured = {
  body: string | null;
  headers: Headers;
  method: string;
  url: string;
};

function capturingFetch(response: Response, captured: Captured): typeof fetch {
  const stub = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    captured.url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    captured.method = init?.method ?? "GET";
    captured.headers = new Headers(init?.headers);
    captured.body =
      init?.body instanceof URLSearchParams
        ? init.body.toString()
        : typeof init?.body === "string"
          ? init.body
          : null;
    return response;
  };
  return stub as unknown as typeof fetch;
}

describe("parseTokenErrorBody", () => {
  test("truncates and strips control characters", () => {
    const body = JSON.stringify({
      error: `e\u0000\u0090${"x".repeat(100)}`,
      error_description: `d\n${"y".repeat(300)}`,
    });
    const parsed = parseTokenErrorBody(body);
    expect(parsed.error).toHaveLength(64);
    expect(parsed.error.startsWith("ex")).toBe(true);
    expect(parsed.error).not.toContain("\u0000");
    expect(parsed.error).not.toContain("\u0090");
    expect(parsed.errorDescription).toHaveLength(200);
    expect(parsed.errorDescription?.startsWith("dy")).toBe(true);
    expect(parsed.errorDescription).not.toContain("\n");
  });

  test("returns unknown_error for a body that is not JSON", () => {
    expect(parseTokenErrorBody("<html>oops</html>")).toEqual({
      error: "unknown_error",
      errorDescription: null,
    });
  });

  test("returns a null description when none was provided", () => {
    expect(
      parseTokenErrorBody(JSON.stringify({ error: "invalid_grant" })),
    ).toEqual({
      error: "invalid_grant",
      errorDescription: null,
    });
  });
});

describe("buildAuthorizeUrl", () => {
  test("sets the authorization query parameters", () => {
    const url = new URL(
      buildAuthorizeUrl(discovery, {
        clientId: "client-id",
        codeChallenge: "challenge",
        nonce: "nonce-1",
        redirectUri: "https://dasa122.net/api/auth/callback",
        scope: "openid profile email groups",
        state: "state-1",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      discovery.authorization_endpoint,
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://dasa122.net/api/auth/callback",
    );
    expect(url.searchParams.get("scope")).toBe("openid profile email groups");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("nonce")).toBe("nonce-1");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("discover", () => {
  test("fetches the openid configuration", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        "https://auth.example/application/o/demo/.well-known/openid-configuration",
      );
      return new Response(JSON.stringify(discovery), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(
      discover("https://auth.example/application/o/demo/", fetchImpl),
    ).resolves.toEqual(discovery);
  });

  test("throws discovery_failed on a non-2xx response", async () => {
    const fetchImpl = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(discover("https://auth.example/", fetchImpl)).rejects.toThrow(
      "discovery_failed",
    );
  });
});

describe("exchangeCode", () => {
  test("posts form data with basic auth and returns the tokens", async () => {
    const captured: Captured = {
      body: null,
      headers: new Headers(),
      method: "",
      url: "",
    };
    const fetchImpl = capturingFetch(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          id_token: "id-token",
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
      captured,
    );

    const result = await exchangeCode({ ...exchangeArgs, fetchImpl });

    expect(result).toEqual({
      access_token: "access-token",
      id_token: "id-token",
      token_type: "Bearer",
    });
    expect(captured.method).toBe("POST");
    expect(captured.url).toBe(discovery.token_endpoint);
    expect(captured.headers.get("Authorization")).toBe(
      `Basic ${btoa("client-id:client-secret")}`,
    );
    expect(captured.headers.get("Content-Type")).toBe(
      "application/x-www-form-urlencoded",
    );
    const params = new URLSearchParams(captured.body ?? "");
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("code-1");
    expect(params.get("code_verifier")).toBe("verifier-1");
    expect(params.get("redirect_uri")).toBe(exchangeArgs.redirectUri);
    expect(params.get("client_id")).toBe("client-id");
  });

  test("throws missing_id_token when the response has no id_token", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ access_token: "access-token", token_type: "Bearer" }),
        { status: 200 },
      )) as unknown as typeof fetch;
    await expect(exchangeCode({ ...exchangeArgs, fetchImpl })).rejects.toThrow(
      "missing_id_token",
    );
  });

  test("reads at most 4096 bytes of an error response", async () => {
    let chunksRead = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(new Uint8Array(1024).fill(0x78));
      },
    });
    const fetchImpl = (async () =>
      new Response(body, { status: 400 })) as unknown as typeof fetch;

    await expect(exchangeCode({ ...exchangeArgs, fetchImpl })).rejects.toThrow(
      "token_exchange_failed: unknown_error",
    );
    // Four 1 KiB pulls reach the cap; a fifth would only be read-ahead.
    expect(chunksRead).toBeLessThanOrEqual(5);
  });
});
