import {
  type adminGithubStatusSchema,
  githubOverviewSchema,
} from "@dasa122/contract";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../database";
import { settingsTable, syncStateTable } from "../../database/schema";
import { env } from "../../env";
import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import type { SyncResult } from "../types";
import {
  GITHUB_FEATURED_KEY,
  GITHUB_OVERVIEW_KEY,
  type GitHubSnapshot,
  syncGitHub,
} from "./sync";

export type GitHubOverview = z.infer<typeof githubOverviewSchema>;
export type AdminGithubStatus = z.infer<typeof adminGithubStatusSchema>;

const GITHUB_SOURCE = "github";

/** The shape `github.overview` promises before anything has been synced. */
const EMPTY_OVERVIEW: GitHubOverview = {
  activity: [],
  languages: {},
  lastSyncedAt: null,
  repos: [],
  totalCommits: 0,
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
    repos: (Array.isArray(snapshot.repos) ? snapshot.repos : []).map(
      (repo) => ({ ...repo, featured: featuredSet.has(repo.name) }),
    ),
    totalCommits: snapshot.totalCommits ?? 0,
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

/** Runs the sync worker once, on behalf of the admin panel. */
export async function triggerGitHubSync(): Promise<SyncResult> {
  return syncGitHub({
    token: env.github.token,
    username: env.github.username,
  });
}

export const githubRouter = {
  overview: base.github.overview.handler(() => getGitHubOverview()),
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
