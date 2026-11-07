import type { OidcDiscovery } from "./oidc";

export type Jwk = {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
};

export type Jwks = { keys: Jwk[] };

const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { fetchedAt: number; jwks: Jwks }>();

/**
 * Fetches (and caches for one hour) the issuer's JSON Web Key Set. A failed
 * fetch throws `jwks_fetch_failed` and leaves any previous cache entry alone.
 */
export async function getJwks(
  discovery: OidcDiscovery,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Jwks> {
  const now = Date.now();
  const cached = cache.get(discovery.jwks_uri);
  if (cached !== undefined && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.jwks;
  }

  const response = await fetchImpl(discovery.jwks_uri);
  if (!response.ok) {
    throw new Error("jwks_fetch_failed");
  }
  const jwks = (await response.json()) as Jwks;
  cache.set(discovery.jwks_uri, { fetchedAt: now, jwks });
  return jwks;
}
