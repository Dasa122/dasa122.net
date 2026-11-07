/**
 * PKCE, state and nonce primitives for the Authentik authorization-code flow.
 * Everything is built on runtime globals: no `node:crypto` and no imports.
 */

const RANDOM_BYTES = 32;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Base64url-encodes bytes: standard base64 with `+`→`-`, `/`→`_` and the `=`
 * padding removed.
 */
export function base64UrlEncode(bytes: Uint8Array | Buffer): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(): string {
  return base64UrlEncode(
    globalThis.crypto.getRandomValues(new Uint8Array(RANDOM_BYTES)),
  );
}

/**
 * Builds an S256 PKCE pair. `generatePkce` is synchronous by contract, and
 * `crypto.subtle.digest` is async-only, so the SHA-256 comes from Bun's
 * synchronous hasher. The digest is byte-identical to `subtle.digest`.
 */
export function generatePkce(): {
  verifier: string;
  challenge: string;
  method: "S256";
} {
  const verifier = randomToken();
  const digest = new Bun.CryptoHasher("sha256").update(verifier).digest();
  return {
    challenge: base64UrlEncode(new Uint8Array(digest)),
    method: "S256",
    verifier,
  };
}

/** A fresh 32-byte random state, base64url-encoded. */
export function generateState(): string {
  return randomToken();
}

/** A fresh 32-byte random OIDC nonce, base64url-encoded. */
export function generateNonce(): string {
  return randomToken();
}
