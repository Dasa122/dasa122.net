const GITHUB_API = "https://api.github.com";
const PER_PAGE = 100;

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
 * Fetches one GitHub JSON document. A non-2xx response throws the same generic
 * error as a transport failure, so callers never leak a provider message.
 */
async function getJson(
  url: string,
  token: string | undefined,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(url, { headers: requestHeaders(token) });
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
