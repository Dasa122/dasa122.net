import {
  type adminGithubStatusSchema,
  githubOverviewSchema,
  type githubRepoDetailSchema,
} from "@dasa122/contract";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../database";
import { settingsTable, syncStateTable } from "../../database/schema";
import { env } from "../../env";
import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import { sanitizeHtml } from "../../util/markdown";
import type { SyncResult } from "../types";
import {
  fetchReadmeHtml,
  fetchRepoDetail,
  GitHubNotFoundError,
} from "./client";
import {
  GITHUB_FEATURED_KEY,
  GITHUB_OVERVIEW_KEY,
  type GitHubSnapshot,
  syncGitHub,
} from "./sync";

export type GitHubOverview = z.infer<typeof githubOverviewSchema>;
export type GitHubRepoDetail = z.infer<typeof githubRepoDetailSchema>;
export type AdminGithubStatus = z.infer<typeof adminGithubStatusSchema>;

const GITHUB_SOURCE = "github";

/** The shape `github.overview` promises before anything has been synced. */
const EMPTY_OVERVIEW: GitHubOverview = {
  activity: [],
  languages: {},
  lastSyncedAt: null,
  pulls: [],
  repos: [],
};

async function readSetting(key: string): Promise<unknown> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

async function readFeaturedRepos(): Promise<string[]> {
  const value = await readSetting(GITHUB_FEATURED_KEY);
  return Array.isArray(value)
    ? value.filter((name): name is string => typeof name === "string")
    : [];
}

function toOverview(
  snapshot: GitHubSnapshot,
  featured: string[],
): GitHubOverview {
  const featuredSet = new Set(featured);
  return {
    activity: Array.isArray(snapshot.activity) ? snapshot.activity : [],
    languages: snapshot.languages ?? {},
    lastSyncedAt: snapshot.syncedAt ?? null,
    pulls: Array.isArray(snapshot.pulls) ? snapshot.pulls : [],
    repos: (Array.isArray(snapshot.repos) ? snapshot.repos : []).map(
      (repo) => ({ ...repo, featured: featuredSet.has(repo.name) }),
    ),
  };
}

/**
 * The public overview, read entirely from the `github:overview` cache. The
 * featured flag is overlaid at read time from `github:featured`, so toggling a
 * repository takes effect without a resync. Never calls GitHub; a missing or
 * corrupt snapshot returns the empty state rather than an error.
 */
export async function getGitHubOverview(): Promise<GitHubOverview> {
  const snapshot = await readSetting(GITHUB_OVERVIEW_KEY);
  if (typeof snapshot !== "object" || snapshot === null) {
    return { ...EMPTY_OVERVIEW };
  }

  const overview = toOverview(
    snapshot as GitHubSnapshot,
    await readFeaturedRepos(),
  );
  const parsed = githubOverviewSchema.safeParse(overview);
  return parsed.success ? parsed.data : { ...EMPTY_OVERVIEW };
}

/**
 * The admin panel state: the last sync's outcome plus the cached repository
 * list. Reads the cache only, so opening the panel makes no GitHub request.
 */
export async function getGitHubStatus(): Promise<AdminGithubStatus> {
  const [state] = await db
    .select({
      lastError: syncStateTable.lastError,
      lastRunAt: syncStateTable.lastRunAt,
      lastStatus: syncStateTable.lastStatus,
    })
    .from(syncStateTable)
    .where(eq(syncStateTable.source, GITHUB_SOURCE))
    .limit(1);
  const overview = await getGitHubOverview();

  return {
    lastError: state?.lastError ?? null,
    lastRunAt: state?.lastRunAt?.toISOString() ?? null,
    lastStatus: state?.lastStatus ?? null,
    repos: overview.repos,
    tokenPresent: env.github.token !== "",
    username: env.github.username,
  };
}

/** Replaces the featured repository set with the full new list. */
export async function setFeaturedRepos(names: string[]): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key: GITHUB_FEATURED_KEY, value: names })
    .onConflictDoUpdate({
      set: { value: names },
      target: settingsTable.key,
    });
}

const REPO_CACHE_TTL_MS = 10 * 60 * 1000;
const README_MAX_CHARS = 300_000;

/** A detail page is expensive against GitHub's unauthenticated 60/hour limit,
 * so a successful fetch is reused for ten minutes. `expiresAt` is a timestamp
 * rather than an age so a stale entry stays usable as a failure fallback. */
const repoCache = new Map<
  string,
  { expiresAt: number; value: GitHubRepoDetail }
>();

/** The in-process cache key; lowercased so `Dasa122/Repo` and `dasa122/repo`
 * share an entry. Pure so it can be tested without the network. */
export function repoCacheKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

/**
 * Caps the rendered README after sanitising. It cuts at the last completed tag
 * so a halfway `<div>` cannot swallow the rest of the page, then reports that
 * the content was shortened.
 */
function capReadme(html: string): { html: string; truncated: boolean } {
  if (html.length <= README_MAX_CHARS) {
    return { html, truncated: false };
  }
  const cut = html.slice(0, README_MAX_CHARS);
  const lastTagEnd = cut.lastIndexOf(">");
  if (lastTagEnd >= README_MAX_CHARS / 2) {
    return { html: cut.slice(0, lastTagEnd + 1), truncated: true };
  }
  // One huge tag or block of text: drop any incomplete trailing tag instead.
  return { html: cut.replace(/<[^>]*$/, ""), truncated: true };
}

/**
 * GitHub's rendered README keeps relative links and images relative (only the
 * markdown source is known to it, not this site's route), so a `media/logo.svg`
 * would resolve against `/github/{owner}/{name}/` and 404. Rewrite them against
 * the repository: `raw` for images, `blob` for links. Absolute URLs, protocol
 * URLs and same-page anchors are left untouched.
 */
function absolutizeReadme(
  html: string,
  owner: string,
  name: string,
  branch: string,
): string {
  const repo = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  return html.replace(/<(?:a|img)\b[^>]*>/gi, (tag) =>
    tag.replace(
      /\s(href|src)="([^"]*)"/gi,
      (match, attribute: string, value: string) => {
        if (
          value === "" ||
          value.startsWith("#") ||
          value.startsWith("//") ||
          /^[a-z][a-z0-9+.-]*:/i.test(value)
        ) {
          return match;
        }
        const kind = attribute.toLowerCase() === "src" ? "raw" : "blob";
        const path = value.replace(/^\.\//, "");
        return ` ${attribute}="${repo}/${kind}/${branch}/${path}"`;
      },
    ),
  );
}

/**
 * One repository and its README. The README comes from GitHub's rendered-HTML
 * endpoint, is sanitised once here (the web app renders it as trusted HTML),
 * and a README failure degrades to no README rather than no page.
 *
 * The cache is in process memory: a hit within the TTL makes no request, and a
 * failed refresh for an expired entry serves the stale copy, so a rate limit
 * or an outage never takes the page down. A 404 is authoritative and is not
 * masked by a stale entry.
 */
export async function getGitHubRepo(
  owner: string,
  name: string,
): Promise<GitHubRepoDetail> {
  const key = repoCacheKey(owner, name);
  const cached = repoCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let metadata: Awaited<ReturnType<typeof fetchRepoDetail>>;
  try {
    metadata = await fetchRepoDetail(owner, name, env.github.token);
  } catch (error) {
    if (error instanceof GitHubNotFoundError) {
      throw new ORPCError("NOT_FOUND", { message: "Repository not found" });
    }
    if (cached) {
      return cached.value;
    }
    throw new ORPCError("BAD_GATEWAY", {
      message: "GitHub is unavailable",
    });
  }

  let readmeHtml: string | null = null;
  let readmeTruncated = false;
  try {
    const rendered = await fetchReadmeHtml(owner, name, env.github.token);
    if (rendered !== null) {
      const capped = capReadme(
        absolutizeReadme(
          sanitizeHtml(rendered),
          metadata.owner,
          metadata.name,
          metadata.defaultBranch,
        ),
      );
      readmeHtml = capped.html;
      readmeTruncated = capped.truncated;
    }
  } catch {
    // A README failure is not a page failure; the repo still renders.
  }

  const value: GitHubRepoDetail = {
    ...metadata,
    readmeHtml,
    readmeTruncated,
  };
  repoCache.set(key, { expiresAt: Date.now() + REPO_CACHE_TTL_MS, value });
  return value;
}

/** Runs the sync worker once, on behalf of the admin panel. */
export async function triggerGitHubSync(): Promise<SyncResult> {
  return syncGitHub({
    token: env.github.token,
    username: env.github.username,
  });
}

export const githubRouter = {
  overview: base.github.overview.handler(() => getGitHubOverview()),
  repo: base.github.repo.handler(({ input }) =>
    getGitHubRepo(input.owner, input.name),
  ),
};

export const adminGithubRouter = {
  featuredRepos: base.adminGithub.featuredRepos.handler(
    async ({ context, input }) => {
      await requireAdmin(context);
      await setFeaturedRepos(input.repos);
      return { repos: input.repos };
    },
  ),
  status: base.adminGithub.status.handler(async ({ context }) => {
    await requireAdmin(context);
    return getGitHubStatus();
  }),
  sync: base.adminGithub.sync.handler(async ({ context }) => {
    await requireAdmin(context);
    return triggerGitHubSync();
  }),
};
