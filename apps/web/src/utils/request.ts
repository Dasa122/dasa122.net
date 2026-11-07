/**
 * Server-only request helpers. `requestOrigin()` reads the live request, so it
 * works only inside a request context; the browser-safe pieces live in
 * `./origin`.
 */
import { getRequestHeaders } from "@tanstack/react-start/server";
import { resolveOrigin } from "./origin";

export { fallbackApiOrigin, resolveOrigin } from "./origin";

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
