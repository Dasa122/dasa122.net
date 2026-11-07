import { getJwks } from "./jwks";
import type { OidcDiscovery } from "./oidc";

export type IdTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  nonce?: string;
  email?: string;
  name?: string;
  groups?: string[];
};

export type IdTokenFailureReason =
  | "issuer_mismatch"
  | "audience_mismatch"
  | "nonce_mismatch"
  | "expired"
  | "missing_claim";

export type IdTokenValidation =
  | { ok: true }
  | { ok: false; reason: IdTokenFailureReason };

type TokenSegments = { header: string; payload: string; signature: string };

function base64UrlToBytes(segment: string): Uint8Array<ArrayBuffer> {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBase64Url(segment: string): string {
  return new TextDecoder().decode(base64UrlToBytes(segment));
}

function splitToken(idToken: string): TokenSegments {
  const parts = idToken.split(".");
  const header = parts[0];
  const payload = parts[1];
  const signature = parts[2];
  if (
    parts.length !== 3 ||
    header === undefined ||
    payload === undefined ||
    signature === undefined
  ) {
    throw new Error("id_token_malformed");
  }
  return { header, payload, signature };
}

function decodeJsonObject(segment: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(segment));
  } catch {
    throw new Error("id_token_malformed");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("id_token_malformed");
  }
  return parsed as Record<string, unknown>;
}

/** Decodes the JWT payload without verifying anything. */
export function decodeIdTokenPayload(idToken: string): unknown {
  const payload = idToken.split(".")[1];
  if (payload === undefined) {
    throw new Error("id_token_malformed");
  }
  try {
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    throw new Error("id_token_malformed");
  }
}

function isTokenAudience(value: unknown): value is string | string[] {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
  );
}

function audienceContains(
  audience: string | string[],
  expected: string,
): boolean {
  return typeof audience === "string"
    ? audience === expected
    : audience.includes(expected);
}

/** Issuer comparison ignores a single trailing slash. */
function normalizeIssuer(issuer: string): string {
  return issuer.endsWith("/") ? issuer.slice(0, -1) : issuer;
}

export function validateIdTokenClaims(args: {
  claims: Record<string, unknown>;
  issuer: string;
  audience: string;
  nonce: string | null;
  nowSeconds?: number;
}): IdTokenValidation {
  const { claims } = args;
  const iss = claims.iss;
  const aud = claims.aud;
  const exp = claims.exp;
  const sub = claims.sub;

  if (
    typeof iss !== "string" ||
    typeof exp !== "number" ||
    typeof sub !== "string" ||
    !isTokenAudience(aud)
  ) {
    return { ok: false, reason: "missing_claim" };
  }
  if (normalizeIssuer(iss) !== normalizeIssuer(args.issuer)) {
    return { ok: false, reason: "issuer_mismatch" };
  }
  if (!audienceContains(aud, args.audience)) {
    return { ok: false, reason: "audience_mismatch" };
  }
  const nowSeconds = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (exp <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }
  if (args.nonce !== null && claims.nonce !== args.nonce) {
    return { ok: false, reason: "nonce_mismatch" };
  }
  return { ok: true };
}

/**
 * Verifies the RS256 signature against the issuer's JWKS and only then trusts
 * the claims. Every failure throws a short, token-free reason.
 */
export async function verifyIdToken(args: {
  idToken: string;
  discovery: OidcDiscovery;
  audience: string;
  nonce: string | null;
  nowSeconds?: number;
  fetchImpl?: typeof fetch;
}): Promise<IdTokenClaims> {
  const { header, payload, signature } = splitToken(args.idToken);
  const headerClaims = decodeJsonObject(header);
  const kid = headerClaims.kid;
  const alg = headerClaims.alg;

  if (typeof kid !== "string" || kid === "") {
    throw new Error("unknown_signing_key");
  }
  if (alg !== "RS256") {
    throw new Error("id_token_signature_invalid");
  }

  const jwks = await getJwks(args.discovery, args.fetchImpl);
  const jwk = jwks.keys.find((candidate) => candidate.kid === kid);
  if (jwk === undefined) {
    throw new Error("unknown_signing_key");
  }

  let key: CryptoKey;
  try {
    key = await globalThis.crypto.subtle.importKey(
      "jwk",
      jwk,
      { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
      false,
      ["verify"],
    );
  } catch {
    throw new Error("id_token_signature_invalid");
  }

  const verified = await globalThis.crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!verified) {
    throw new Error("id_token_signature_invalid");
  }

  const claims = decodeIdTokenPayload(args.idToken);
  if (typeof claims !== "object" || claims === null || Array.isArray(claims)) {
    throw new Error("id_token_malformed");
  }
  const record = claims as Record<string, unknown>;
  const validation = validateIdTokenClaims({
    audience: args.audience,
    claims: record,
    issuer: args.discovery.issuer,
    nonce: args.nonce,
    nowSeconds: args.nowSeconds,
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  return record as IdTokenClaims;
}
