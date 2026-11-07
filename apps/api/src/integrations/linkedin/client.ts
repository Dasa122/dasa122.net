const LINKEDIN_API = "https://api.linkedin.com";
const REQUEST_TIMEOUT_MS = 15_000;

/** The scopes and display name a token reports from `GET /v2/userinfo`. */
export type LinkedInGrants = {
  name: string | null;
  scopes: string[] | null;
};

/** One post from `GET /rest/posts`, normalised to what the feed needs. */
export type LinkedInPost = {
  id: string;
  permalink: string;
  publishedAt: Date;
  text: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Performs one authenticated LinkedIn GET. A transport failure or a request
 * that exceeds the timeout is reported as `linkedin_api_error`, so callers
 * never leak a provider message and a hung request cannot stack up runs.
 */
async function get(
  path: string,
  accessToken: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<Response> {
  try {
    return await fetchImpl(`${LINKEDIN_API}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, ...headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error("linkedin_api_error");
    }
    throw error;
  }
}

/**
 * Reads the token's granted scopes. A token that cannot be introspected is an
 * API failure; only a successful response with an absent `scope` field yields
 * unknown (`null`) scopes.
 */
export async function fetchLinkedInGrants(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<LinkedInGrants> {
  const response = await get("/v2/userinfo", accessToken, {}, fetchImpl);
  if (!response.ok) {
    throw new Error("linkedin_api_error");
  }

  const data = asRecord((await response.json()) as unknown);
  const scope = typeof data?.scope === "string" ? data.scope.trim() : "";
  return {
    name: typeof data?.name === "string" ? data.name : null,
    scopes: scope === "" ? null : scope.split(/\s+/),
  };
}

/**
 * Reads the member's posts. `403` is the one status the admin panel explains:
 * the token is valid but the app was never granted `r_member_social`.
 */
export async function fetchLinkedInPosts(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<LinkedInPost[]> {
  const response = await get(
    "/rest/posts",
    accessToken,
    {
      "LinkedIn-Version": "202501",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    fetchImpl,
  );

  if (response.status === 403) {
    throw new Error("linkedin_insufficient_scope");
  }
  if (!response.ok) {
    throw new Error("linkedin_api_error");
  }

  const data = asRecord((await response.json()) as unknown);
  const elements = data?.elements;
  if (!Array.isArray(elements)) {
    return [];
  }

  return elements.flatMap((element) => {
    const record = asRecord(element);
    if (record === null) {
      return [];
    }
    const id = typeof record.id === "string" ? record.id : null;
    const permalink = typeof record.url === "string" ? record.url : null;
    const publishedAtField = record.publishedAt;
    const publishedAt = new Date(
      typeof publishedAtField === "string" ||
        typeof publishedAtField === "number"
        ? publishedAtField
        : Number.NaN,
    );
    if (
      id === null ||
      permalink === null ||
      Number.isNaN(publishedAt.getTime())
    ) {
      return [];
    }
    return [
      {
        id,
        permalink,
        publishedAt,
        text: typeof record.commentary === "string" ? record.commentary : "",
      },
    ];
  });
}
