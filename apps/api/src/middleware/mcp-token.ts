// biome-ignore lint/correctness/noNodejsModules: timingSafeEqual has no Web Crypto equivalent.
import { createHash, timingSafeEqual } from "node:crypto";
import type { SessionRecord } from "../auth/session";

/** The synthetic session id a service-token request is attributed to. */
const MCP_SESSION_ID = "mcp-token";
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Compares two secrets without leaking their contents or their lengths through
 * timing. Both sides are hashed to a fixed 32 bytes first, so `timingSafeEqual`
 * never sees buffers of different sizes (which would throw) and the comparison
 * cannot short-circuit on a shared prefix.
 */
export function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

/**
 * Extracts the credential from an `Authorization: Bearer <value>` header.
 * Returns `null` when the header is absent, malformed, or uses another scheme;
 * `hasBearerScheme` distinguishes the malformed-bearer case.
 */
export function parseBearerToken(header: string | null): string | null {
  if (header === null) {
    return null;
  }
  const match = /^Bearer +(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * True when the header *tried* to use the bearer scheme, even if the credential
 * is malformed (`Bearer a b`, `Bearer\tx`). Such a request must not fall back
 * to the cookie session.
 */
export function hasBearerScheme(header: string | null): boolean {
  return header !== null && /^bearer\b/i.test(header.trim());
}

/**
 * Turns a bearer credential into the synthetic admin session. An empty
 * `expected` token means the feature is disabled; a mismatch yields `null`
 * rather than falling back to any other authentication path.
 */
export function mcpTokenSession(
  token: string,
  expected: string,
  adminGroup: string,
): SessionRecord | null {
  if (expected === "" || !constantTimeEqual(token, expected)) {
    return null;
  }
  return {
    email: null,
    expiresAt: new Date(Date.now() + MS_PER_YEAR),
    groups: [adminGroup],
    id: MCP_SESSION_ID,
    name: "MCP",
    subject: MCP_SESSION_ID,
  };
}
