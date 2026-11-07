/**
 * The login URL for an anonymous visitor, carrying where they were heading.
 *
 * Only a same-origin path is accepted as a return target: a value that is
 * absolute (`https://…`) or protocol-relative (`//…`) would turn the login
 * hand-off into an open redirect, so it falls back to the bare login URL.
 */
export function adminRedirectTarget(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/api/auth/login";
  }
  return `/api/auth/login?returnTo=${encodeURIComponent(pathname)}`;
}
