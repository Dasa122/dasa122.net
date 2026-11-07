/**
 * The login URL for an anonymous visitor, carrying where they were heading.
 *
 * Only a same-origin path is accepted as a return target: a value that is
 * absolute (`https://…`), protocol-relative (`//…`), contains a backslash
 * (which URL parsers normalize to `/`) or contains a control character (which
 * could split the `Location` header) would turn the login hand-off into an open
 * redirect. Those all fall back to the bare login URL, mirroring the server's
 * `safeReturnTo`.
 */
export function adminRedirectTarget(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/api/auth/login";
  }
  if (hasUnsafeCharacter(pathname)) {
    return "/api/auth/login";
  }
  return `/api/auth/login?returnTo=${encodeURIComponent(pathname)}`;
}

/** Which branch of the admin gate an API failure belongs to. */
export type AdminErrorKind = "forbidden" | "unauthorized" | "other";

/**
 * Classifies a rejected admin request by its oRPC error code. `FORBIDDEN` is a
 * signed-in user without the admin group (render the panel); `UNAUTHORIZED` is
 * an anonymous visitor (send to login); anything else is not an auth decision.
 */
export function classifyAdminError(error: unknown): AdminErrorKind {
  if (hasCode(error, "FORBIDDEN")) {
    return "forbidden";
  }
  if (hasCode(error, "UNAUTHORIZED")) {
    return "unauthorized";
  }
  return "other";
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function hasUnsafeCharacter(value: string): boolean {
  if (value.includes("\\")) {
    return true;
  }
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}
