/**
 * Browser-safe origin helpers: no server-only imports live here, so any client
 * module may import this file.
 */

const configuredOrigin =
  import.meta.env.VITE_API_ORIGIN || "https://dasa122.net";

/**
 * Absolute fallback origin for server renders. Normalised through `URL` so a
 * trailing slash or a stray path cannot produce a malformed API URL; throws at
 * import when the configured value is not an absolute URL.
 */
export const fallbackApiOrigin: string = new URL(configuredOrigin).origin;

/** The first value of a possibly comma-chained proxy header. */
function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

/**
 * Build an origin from `x-forwarded-proto` and `x-forwarded-host`.
 * Returns `null` when either header is absent or empty, so the caller can
 * fall back.
 */
export function resolveOrigin(
  headers: Record<string, string | undefined>,
): string | null {
  const proto = firstHeaderValue(headers["x-forwarded-proto"]);
  const host = firstHeaderValue(headers["x-forwarded-host"]);
  if (!proto || !host) {
    return null;
  }
  return `${proto}://${host}`;
}
