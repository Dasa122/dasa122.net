/**
 * Resolve the public origin for server-side API calls.
 *
 * The platform proxies `/api` to the API container on the same public origin,
 * so a server render must call back out through the host the browser used.
 * That host is only available on the request itself, via the forwarded
 * headers a reverse proxy sets.
 */
import { getRequestHeaders } from "@tanstack/react-start/server";

export const fallbackApiOrigin: string =
  import.meta.env.VITE_API_ORIGIN ?? "https://dasa122.net";

/**
 * Build an origin from `x-forwarded-proto` and `x-forwarded-host`.
 * Returns `null` when either header is absent, so the caller can fall back.
 */
export function resolveOrigin(
  headers: Record<string, string | undefined>,
): string | null {
  const proto = headers["x-forwarded-proto"];
  const host = headers["x-forwarded-host"];
  if (!proto || !host) {
    return null;
  }
  return `${proto}://${host}`;
}

/**
 * The origin of the current request, or `null` outside a request context
 * (module evaluation, background work).
 */
export function requestOrigin(): string | null {
  try {
    const headers = getRequestHeaders();
    return resolveOrigin({
      "x-forwarded-host": headers.get("x-forwarded-host") ?? undefined,
      "x-forwarded-proto": headers.get("x-forwarded-proto") ?? undefined,
    });
  } catch {
    return null;
  }
}
