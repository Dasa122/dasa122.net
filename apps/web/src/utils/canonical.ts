import { createIsomorphicFn } from "@tanstack/react-start";
import { fallbackApiOrigin } from "./origin";
import { requestOrigin } from "./request";

/**
 * The public origin for canonical and Open Graph URLs. Only the server can
 * read the live request, so the browser falls back to the configured origin.
 */
export const canonicalOrigin = createIsomorphicFn()
  .client(() => fallbackApiOrigin)
  .server(() => requestOrigin() ?? fallbackApiOrigin);
