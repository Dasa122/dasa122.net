import { describe, expect, test } from "bun:test";
import {
  decodeIdTokenPayload,
  type IdTokenClaims,
  validateIdTokenClaims,
  verifyIdToken,
} from "./id-token";
import type { Jwk } from "./jwks";
import type { OidcDiscovery } from "./oidc";
import { base64UrlEncode } from "./pkce";

const now = 1_800_000_000;

function claims(overrides: Record<string, unknown> = {}) {
  return {
    aud: "client-id",
    exp: now + 300,
    groups: ["dasa122.net-admin"],
    iss: "https://auth.dasa122.net/application/o/demo/",
    nonce: "nonce-1",
    sub: "user-1",
    ...overrides,
  };
}

describe("validateIdTokenClaims", () => {
  test("accepts valid claims", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims(),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: "nonce-1",
      nowSeconds: now,
    });
    expect(result.ok).toBe(true);
  });

  test("rejects a wrong issuer", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims({ iss: "https://evil.example/" }),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: "nonce-1",
      nowSeconds: now,
    });
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, reason: "issuer_mismatch" });
  });

  test("rejects a wrong audience", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims({ aud: "other-client" }),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: "nonce-1",
      nowSeconds: now,
    });
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, reason: "audience_mismatch" });
  });

  test("rejects a mismatched nonce", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims({ nonce: "other" }),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: "nonce-1",
      nowSeconds: now,
    });
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, reason: "nonce_mismatch" });
  });

  test("rejects an expired token", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims({ exp: now - 1 }),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: "nonce-1",
      nowSeconds: now,
    });
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  test("rejects claims missing a required field", () => {
    for (const missing of ["iss", "aud", "exp", "sub"]) {
      const result = validateIdTokenClaims({
        audience: "client-id",
        claims: claims({ [missing]: undefined }),
        issuer: "https://auth.dasa122.net/application/o/demo/",
        nonce: "nonce-1",
        nowSeconds: now,
      });
      expect(result).toEqual({ ok: false, reason: "missing_claim" });
    }
  });

  test("accepts an audience array containing the client id", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims({ aud: ["other", "client-id"] }),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: null,
      nowSeconds: now,
    });
    expect(result.ok).toBe(true);
  });

  test("ignores a single trailing slash when comparing issuers", () => {
    const result = validateIdTokenClaims({
      audience: "client-id",
      claims: claims({ iss: "https://auth.dasa122.net/application/o/demo" }),
      issuer: "https://auth.dasa122.net/application/o/demo/",
      nonce: null,
      nowSeconds: now,
    });
    expect(result.ok).toBe(true);
  });
});

describe("decodeIdTokenPayload", () => {
  test("throws id_token_malformed for an undecodable token", () => {
    expect(() => decodeIdTokenPayload("not-a-token")).toThrow(
      "id_token_malformed",
    );
    expect(() => decodeIdTokenPayload("a.@@@.c")).toThrow("id_token_malformed");
  });
});

type KeyPair = { privateKey: CryptoKey; publicKey: CryptoKey };

async function generateKeyPair(): Promise<KeyPair> {
  const pair = (await crypto.subtle.generateKey(
    {
      hash: "SHA-256",
      modulusLength: 2048,
      name: "RSASSA-PKCS1-v1_5",
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

async function toJwk(publicKey: CryptoKey, kid: string): Promise<Jwk> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return {
    alg: "RS256",
    e: jwk.e ?? "",
    kid,
    kty: jwk.kty ?? "",
    n: jwk.n ?? "",
  };
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

type SignedToken = {
  header: string;
  payload: string;
  signature: string;
  token: string;
};

async function signToken(
  key: CryptoKey,
  kid: string,
  tokenClaims: Record<string, unknown>,
): Promise<SignedToken> {
  const header = encodeJson({ alg: "RS256", kid, typ: "JWT" });
  const payload = encodeJson(tokenClaims);
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const signatureSegment = base64UrlEncode(new Uint8Array(signature));
  return {
    header,
    payload,
    signature: signatureSegment,
    token: `${signingInput}.${signatureSegment}`,
  };
}

let discoveryCount = 0;

function makeDiscovery(): OidcDiscovery {
  discoveryCount += 1;
  return {
    authorization_endpoint: "https://auth.example/authorize",
    issuer: "https://auth.example/application/o/demo/",
    jwks_uri: `https://auth.example/jwks/${discoveryCount}`,
    token_endpoint: "https://auth.example/token",
  };
}

function jwksFetch(keys: Jwk[]): typeof fetch {
  const stub = async (): Promise<Response> =>
    new Response(JSON.stringify({ keys }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  return stub as unknown as typeof fetch;
}

function tokenClaims(discovery: OidcDiscovery, overrides = {}) {
  return {
    aud: "client-id",
    exp: now + 300,
    iss: discovery.issuer,
    nonce: "nonce-1",
    sub: "user-1",
    ...overrides,
  };
}

describe("verifyIdToken", () => {
  test("accepts a token signed by the matching key", async () => {
    const discovery = makeDiscovery();
    const { privateKey, publicKey } = await generateKeyPair();
    const jwk = await toJwk(publicKey, "key-1");
    const { token } = await signToken(
      privateKey,
      "key-1",
      tokenClaims(discovery),
    );

    const result = await verifyIdToken({
      audience: "client-id",
      discovery,
      fetchImpl: jwksFetch([jwk]),
      idToken: token,
      nonce: "nonce-1",
      nowSeconds: now,
    });

    expect(result.sub).toBe("user-1");
  });

  test("rejects a token signed by a different key", async () => {
    const discovery = makeDiscovery();
    const trusted = await generateKeyPair();
    const attacker = await generateKeyPair();
    const jwk = await toJwk(trusted.publicKey, "key-1");
    // Same kid as the trusted key, but signed by a key the provider never
    // published: the signature check must fail.
    const { token } = await signToken(
      attacker.privateKey,
      "key-1",
      tokenClaims(discovery),
    );

    await expect(
      verifyIdToken({
        audience: "client-id",
        discovery,
        fetchImpl: jwksFetch([jwk]),
        idToken: token,
        nonce: "nonce-1",
        nowSeconds: now,
      }),
    ).rejects.toThrow("id_token_signature_invalid");
  });

  test("rejects a token whose kid matches no published key", async () => {
    const discovery = makeDiscovery();
    const { privateKey, publicKey } = await generateKeyPair();
    const jwk = await toJwk(publicKey, "key-1");
    const { token } = await signToken(
      privateKey,
      "key-999",
      tokenClaims(discovery),
    );

    await expect(
      verifyIdToken({
        audience: "client-id",
        discovery,
        fetchImpl: jwksFetch([jwk]),
        idToken: token,
        nonce: "nonce-1",
        nowSeconds: now,
      }),
    ).rejects.toThrow("unknown_signing_key");
  });

  test("rejects a token whose payload was altered after signing", async () => {
    const discovery = makeDiscovery();
    const { privateKey, publicKey } = await generateKeyPair();
    const jwk = await toJwk(publicKey, "key-1");
    const { header, signature } = await signToken(
      privateKey,
      "key-1",
      tokenClaims(discovery),
    );
    const alteredPayload = encodeJson(
      tokenClaims(discovery, { sub: "mallory" }),
    );
    const alteredToken = `${header}.${alteredPayload}.${signature}`;

    await expect(
      verifyIdToken({
        audience: "client-id",
        discovery,
        fetchImpl: jwksFetch([jwk]),
        idToken: alteredToken,
        nonce: "nonce-1",
        nowSeconds: now,
      }),
    ).rejects.toThrow("id_token_signature_invalid");
  });

  test("validates claims only after the signature verifies", async () => {
    const discovery = makeDiscovery();
    const { privateKey, publicKey } = await generateKeyPair();
    const jwk = await toJwk(publicKey, "key-1");
    const { token } = await signToken(
      privateKey,
      "key-1",
      tokenClaims(discovery, { aud: "other-client" }),
    );

    await expect(
      verifyIdToken({
        audience: "client-id",
        discovery,
        fetchImpl: jwksFetch([jwk]),
        idToken: token,
        nonce: "nonce-1",
        nowSeconds: now,
      }),
    ).rejects.toThrow("audience_mismatch");
  });
});

// `IdTokenClaims` is part of the module contract; keep a compile-time usage so
// the exported type cannot silently drift.
const _claimsShape: IdTokenClaims = {
  aud: "client-id",
  exp: now,
  iss: "https://auth.example/",
  sub: "user-1",
};
void _claimsShape;
