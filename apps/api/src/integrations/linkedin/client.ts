import { LINKEDIN_REQUIRED_SCOPE, type LinkedInTier } from "./tier";

const LINKEDIN_API = "https://api.linkedin.com";
const REQUEST_TIMEOUT_MS = 15_000;

/** The headers `GET /rest/posts` requires; the version is pinned. */
const POSTS_HEADERS = {
  "LinkedIn-Version": "202501",
  "X-Restli-Protocol-Version": "2.0.0",
};

/** One post from `GET /rest/posts`, normalised to what the feed needs. */
export type LinkedInPost = {
  id: string;
  permalink: string;
  publishedAt: Date;
  text: string;
};

/** What one `/rest/posts` probe says about the token's tier. */
export type LinkedInProbe = {
  error: string | null;
  scopes: string[] | null;
  tier: LinkedInTier;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
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

/** The `elements` array, or `null` when the body is not a post list. */
function postElements(data: unknown): unknown[] | null {
  const record = asRecord(data);
  if (record === null || !Array.isArray(record.elements)) {
    return null;
  }
  return record.elements;
}

function toPost(element: unknown): LinkedInPost | null {
  const record = asRecord(element);
  if (record === null) {
    return null;
  }
  const id = typeof record.id === "string" ? record.id : null;
  const permalink = typeof record.url === "string" ? record.url : null;
  const publishedAtField = record.publishedAt;
  const publishedAt = new Date(
    typeof publishedAtField === "string" || typeof publishedAtField === "number"
      ? publishedAtField
      : Number.NaN,
  );
  if (
    id === null ||
    permalink === null ||
    Number.isNaN(publishedAt.getTime())
  ) {
    return null;
  }
  return {
    id,
    permalink,
    publishedAt,
    text: typeof record.commentary === "string" ? record.commentary : "",
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
    POSTS_HEADERS,
    fetchImpl,
  );

  if (response.status === 403) {
    throw new Error("linkedin_insufficient_scope");
  }
  if (!response.ok) {
    throw new Error("linkedin_api_error");
  }

  const elements = postElements((await response.json()) as unknown);
  if (elements === null) {
    return [];
  }
  return elements.flatMap((element) => {
    const post = toPost(element);
    return post === null ? [] : [post];
  });
}

/**
 * `/rest/posts` is the resource `r_member_social` gates, so its answer is the
 * tier: 200 → active, 403 → insufficient_scope, anything else (or a 200 whose
 * body is not a post list) → manual with the failure retained.
 *
 * LinkedIn's OIDC userinfo response carries no `scope` field, which is why
 * this probe does not use it.
 */
export async function probeLinkedInTier(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<LinkedInProbe> {
  let response: Response;
  try {
    response = await get("/rest/posts", accessToken, POSTS_HEADERS, fetchImpl);
  } catch (error) {
    return { error: errorMessage(error), scopes: null, tier: "manual" };
  }

  if (response.status === 403) {
    return { error: null, scopes: [], tier: "insufficient_scope" };
  }
  if (!response.ok) {
    return { error: "linkedin_api_error", scopes: null, tier: "manual" };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { error: "linkedin_api_error", scopes: null, tier: "manual" };
  }
  if (postElements(data) === null) {
    return { error: "linkedin_api_error", scopes: null, tier: "manual" };
  }

  return {
    error: null,
    scopes: [LINKEDIN_REQUIRED_SCOPE],
    tier: "active",
  };
}
