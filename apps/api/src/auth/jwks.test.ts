import { describe, expect, test } from "bun:test";
import { getJwks } from "./jwks";
import type { OidcDiscovery } from "./oidc";

const discovery: OidcDiscovery = {
  authorization_endpoint: "https://auth.example/authorize",
  issuer: "https://auth.example/",
  jwks_uri: "https://auth.example/jwks",
  token_endpoint: "https://auth.example/token",
};

const published = {
  keys: [
    {
      alg: "RS256",
      e: "AQAB",
      kid: "key-1",
      kty: "RSA",
      n: "sXch1cX-1cXch1cX-1cXch1cX-1cXch1cX-1cXch1cX",
    },
  ],
};

describe("getJwks", () => {
  test("caches the keys for one hour and refetches after that", async () => {
    const realNow = Date.now;
    const start = 1_000_000;
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify(published), { status: 200 });
    }) as unknown as typeof fetch;

    try {
      Date.now = () => start;
      await expect(getJwks(discovery, fetchImpl)).resolves.toEqual(published);
      await getJwks(discovery, fetchImpl);
      expect(calls).toBe(1);

      Date.now = () => start + 60 * 60 * 1000;
      await getJwks(discovery, fetchImpl);
      expect(calls).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });

  test("throws jwks_fetch_failed on a non-2xx response", async () => {
    const failing: OidcDiscovery = {
      ...discovery,
      jwks_uri: "https://auth.example/jwks/failing",
    };
    const fetchImpl = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;

    await expect(getJwks(failing, fetchImpl)).rejects.toThrow(
      "jwks_fetch_failed",
    );
  });
});
