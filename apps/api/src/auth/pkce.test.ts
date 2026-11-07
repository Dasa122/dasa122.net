import { describe, expect, test } from "bun:test";
import {
  base64UrlEncode,
  generateNonce,
  generatePkce,
  generateState,
} from "./pkce";

describe("pkce", () => {
  test("challenge is the base64url SHA-256 of the verifier", async () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    expect(challenge).toBe(base64UrlEncode(new Uint8Array(digest)));
  });

  test("challenge contains no characters outside the base64url alphabet", () => {
    const { challenge } = generatePkce();
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("state and nonce are unique across calls", () => {
    expect(generateState()).not.toBe(generateState());
    expect(generateNonce()).not.toBe(generateNonce());
  });
});
