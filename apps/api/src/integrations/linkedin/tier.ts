/** How much of the LinkedIn integration is available right now. */
export type LinkedInTier =
  | "manual"
  | "active"
  | "insufficient_scope"
  | "unconfigured";

/** The credentials `LINKEDIN_*` supplies; an empty string counts as absent. */
export type LinkedInConfig = {
  accessToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
};

export const LINKEDIN_REQUIRED_SCOPE = "r_member_social";

function isBlank(value: string | null): boolean {
  return value === null || value.trim() === "";
}

/**
 * Resolves the tier from the credentials alone plus whatever scopes the token
 * was observed to carry. `grantedScopes` is `null` when they are not known yet,
 * which keeps the poller dormant instead of guessing.
 *
 * The five rules are evaluated in order and the first match wins.
 */
export function resolveLinkedInTier(
  config: LinkedInConfig,
  grantedScopes: string[] | null,
): LinkedInTier {
  if (isBlank(config.clientId) || isBlank(config.clientSecret)) {
    return "unconfigured";
  }
  if (isBlank(config.accessToken)) {
    return "manual";
  }
  if (grantedScopes === null) {
    return "manual";
  }
  if (grantedScopes.includes(LINKEDIN_REQUIRED_SCOPE)) {
    return "active";
  }
  return "insufficient_scope";
}
