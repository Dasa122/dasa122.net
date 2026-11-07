/**
 * Browser-safe origin helpers: no server-only imports live here, so any client
 * module may import this file.
 */

const DEV_FALLBACK_ORIGIN = "http://localhost:3001";
const PRODUCTION_FALLBACK_ORIGIN = "https://dasa122.net";

/**
 * Resolve the absolute API origin for server renders.
 *
 * A configured value wins; an empty or unset one falls back to localhost in
 * development and to the public site in a production build. The result is
 * normalised through `URL`, so a trailing slash or stray path cannot produce a
 * malformed API URL, and an unparseable value throws.
 */
export function resolveFallbackOrigin(
  configured: string | undefined,
  isDev: boolean,
): string {
  const value =
    configured || (isDev ? DEV_FALLBACK_ORIGIN : PRODUCTION_FALLBACK_ORIGIN);
  return new URL(value).origin;
}

/**
 * Absolute fallback origin for server renders. `import.meta.env.DEV` is baked
 * in at build time: `true` under `vite dev`, `false` in a production build.
 */
export const fallbackApiOrigin: string = resolveFallbackOrigin(
  import.meta.env.VITE_API_ORIGIN,
  import.meta.env.DEV,
);

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
