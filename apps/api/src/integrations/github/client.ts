import { renderMarkdown } from "../../util/markdown";

const GITHUB_API = "https://api.github.com";
const PER_PAGE = 100;
const PULL_PER_PAGE = 50;
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

/** One pull request from `GET /search/issues?q=author:…+type:pr`. */
export type GitHubPull = {
  bodyHtml: string | null;
  createdAt: string;
  merged: boolean;
  number: number;
  repo: string;
  state: "open" | "closed";
  title: string;
  updatedAt: string;
  url: string;
};

const PULL_BODY_MAX_CHARS = 40_000;
const PULL_BODY_NOTICE = "<p><em>Description truncated.</em></p>";

/**
 * Caps a rendered PR description below the contract's practical payload size.
 * The cut lands on a completed tag so an open `<div>` cannot swallow the
 * notice, and the notice itself is inside the budget.
 */
function capPullBody(html: string): string {
  if (html.length <= PULL_BODY_MAX_CHARS) {
    return html;
  }
  const budget = PULL_BODY_MAX_CHARS - PULL_BODY_NOTICE.length;
  const cut = html.slice(0, budget);
  const lastTagEnd = cut.lastIndexOf(">");
  const base =
    lastTagEnd >= budget / 2
      ? cut.slice(0, lastTagEnd + 1)
      : cut.replace(/<[^>]*$/, "");
  return `${base}${PULL_BODY_NOTICE}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** `https://api.github.com/repos/owner/name` → `owner/name`. */
function repoFromApiUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /\/repos\/([^/]+)\/([^/]+)\/?$/.exec(value);
  return match === null ? null : `${match[1]}/${match[2]}`;
}

/** An ISO datetime normalised to UTC, or `null` for unusable input. */
function isoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A web URL, or `null` for a non-string, malformed or non-http(s) value. */
function webUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Maps one search result to the page's pull shape. Anything malformed yields
 * `null` so one bad item is skipped rather than failing the whole sync.
 */
async function mapPull(item: unknown): Promise<GitHubPull | null> {
  const record = asRecord(item);
  if (record === null) {
    return null;
  }
  const number = record.number;
  const state = record.state;
  const mergedAt = asRecord(record.pull_request)?.merged_at;
  const title = record.title;
  const url = webUrl(record.html_url);
  const repo = repoFromApiUrl(record.repository_url);
  const createdAt = isoDate(record.created_at);
  const updatedAt = isoDate(record.updated_at);
  if (
    typeof number !== "number" ||
    !Number.isInteger(number) ||
    (state !== "open" && state !== "closed") ||
    typeof title !== "string" ||
    url === null ||
    repo === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const body = typeof record.body === "string" ? record.body.trim() : "";
  return {
    bodyHtml: body === "" ? null : capPullBody(await renderMarkdown(body)),
    createdAt,
    merged: mergedAt !== null && mergedAt !== undefined,
    number,
    repo,
    state,
    title,
    updatedAt,
    url,
  };
}

/**
 * The pull requests authored by `username`, newest update first. GitHub's
 * search API returns 30 results per page by default; 50 is the page size we
 * ask for. A malformed item is skipped, and a non-object payload yields none.
 */
export async function fetchPulls(
  username: string,
  token?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GitHubPull[]> {
  const query = encodeURIComponent(`author:${username} type:pr`);
  const data = await getJson(
    `${GITHUB_API}/search/issues?q=${query}&sort=updated&order=desc&per_page=${PULL_PER_PAGE}`,
    token,
    fetchImpl,
  );
  const items = asRecord(data)?.items;
  if (!Array.isArray(items)) {
    return [];
  }
  const pulls: GitHubPull[] = [];
  for (const item of items) {
    const pull = await mapPull(item);
    if (pull !== null) {
      pulls.push(pull);
    }
  }
  return pulls;
}
