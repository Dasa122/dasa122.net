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
 *
 * A proxy that terminates TLS and forwards over plain HTTP may rewrite
 * `x-forwarded-proto` to `http` even though the client used `https` (Traefik
 * does exactly that for its `http` entrypoint). Believing it produces an API
 * origin that the edge 308-redirects, and `RPCLink` refuses to follow a
 * redirect — every server render then fails. An `http` origin is only
 * plausible for a loopback host, so upgrade everything else to `https`.
 */
export function resolveOrigin(
  headers: Record<string, string | undefined>,
): string | null {
  const proto = firstHeaderValue(headers["x-forwarded-proto"]);
  const host = firstHeaderValue(headers["x-forwarded-host"]);
  if (!proto || !host) {
    return null;
  }
  return `${schemeFor(proto, host)}://${host}`;
}

function schemeFor(proto: string, host: string): string {
  if (proto !== "http") {
    return proto;
  }
  return isLoopbackHost(host) ? "http" : "https";
}

function isLoopbackHost(host: string): boolean {
  // Strip the port; `[::1]:3000` keeps its brackets.
  const hostname = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : (host.split(":")[0] ?? host);
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}
