const GITHUB_API = "https://api.github.com";
const PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 15_000;

/** A public event from `GET /users/:username/events/public`. */
export type GitHubEvent = {
  actor: { login: string };
  created_at: string;
  id: string;
  payload: Record<string, unknown>;
  repo: { name: string };
  type: string;
};

/** A repository from `GET /users/:username/repos`. */
export type GitHubRepo = {
  description: string | null;
  fork: boolean;
  forks_count: number;
  html_url: string;
  language: string | null;
  name: string;
  stargazers_count: number;
  updated_at: string;
};

/** One repository from `GET /repos/:owner/:repo`, mapped to the page's fields. */
export type GitHubRepoMetadata = {
  defaultBranch: string;
  description: string | null;
  forks: number;
  htmlUrl: string;
  language: string | null;
  name: string;
  owner: string;
  stars: number;
  updatedAt: string;
};

/** A GitHub 404, so a missing repository can map to `NOT_FOUND` rather than
 * the generic provider failure every other error maps to. */
export class GitHubNotFoundError extends Error {
  constructor() {
    super("github_not_found");
    this.name = "GitHubNotFoundError";
  }
}

/** The headers GitHub asks clients to send; the token is optional. */
function requestHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token !== undefined && token !== "") {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * One GitHub request, with the shared timeout discipline. `Accept` is a
 * parameter because the README endpoint negotiates rendered HTML rather than
 * JSON. A timeout or transport failure throws the same generic error the
 * callers below use.
 */
async function request(
  url: string,
  token: string | undefined,
  fetchImpl: typeof fetch,
  accept = "application/vnd.github+json",
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      headers: { ...requestHeaders(token), Accept: accept },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error("github_api_error");
    }
    throw error;
  }
}

/**
 * Fetches one GitHub JSON document. A non-2xx response, a transport failure or
 * a request that exceeds the timeout throws the same generic error, so callers
 * never leak a provider message and a hung request cannot stack up runs.
 */
async function getJson(
  url: string,
  token: string | undefined,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await request(url, token, fetchImpl);
  if (!response.ok) {
    throw new Error("github_api_error");
  }
  return (await response.json()) as unknown;
}

/** The user's public events, newest first. A non-array payload yields none. */
export async function fetchPublicEvents(
  username: string,
  token?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GitHubEvent[]> {
  const data = await getJson(
    `${GITHUB_API}/users/${encodeURIComponent(username)}/events/public?per_page=${PER_PAGE}`,
    token,
    fetchImpl,
  );
  return Array.isArray(data) ? (data as GitHubEvent[]) : [];
}

/** The user's repositories, most recently updated first. */
export async function fetchRepos(
  username: string,
  token?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GitHubRepo[]> {
  const data = await getJson(
    `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=${PER_PAGE}&sort=updated`,
    token,
    fetchImpl,
  );
  return Array.isArray(data) ? (data as GitHubRepo[]) : [];
}

/** The subset of `GET /repos/:owner/:repo` the repo page needs. */
type GitHubRepoPayload = {
  default_branch: string;
  description: string | null;
  forks_count: number;
  html_url: string;
  language: string | null;
  name: string;
  owner: { login: string };
  stargazers_count: number;
  updated_at: string;
};

/**
 * One repository's metadata. A 404 throws `GitHubNotFoundError`; every other
 * failure throws the generic error.
 */
export async function fetchRepoDetail(
  owner: string,
  name: string,
  token?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GitHubRepoMetadata> {
  const response = await request(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    token,
    fetchImpl,
  );
  if (response.status === 404) {
    throw new GitHubNotFoundError();
  }
  if (!response.ok) {
    throw new Error("github_api_error");
  }

  const data = (await response.json()) as GitHubRepoPayload;
  return {
    defaultBranch: data.default_branch,
    description: data.description ?? null,
    forks: data.forks_count,
    htmlUrl: data.html_url,
    language: data.language ?? null,
    name: data.name,
    owner: data.owner.login,
    stars: data.stargazers_count,
    updatedAt: data.updated_at,
  };
}

/**
 * The repository README already rendered by GitHub, with relative links and
 * images rewritten to absolute GitHub URLs. `application/vnd.github.html+json`
 * is what makes GitHub do that rewrite; rendering markdown locally would leave
 * `./docs/...` links pointing at this site. No README is `null`, not an error.
 */
export async function fetchReadmeHtml(
  owner: string,
  name: string,
  token?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  const response = await request(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`,
    token,
    fetchImpl,
    "application/vnd.github.html+json",
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("github_api_error");
  }
  return await response.text();
}
