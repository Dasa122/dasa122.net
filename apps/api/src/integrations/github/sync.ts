import { eq } from "drizzle-orm";
import { db } from "../../database";
import { settingsTable, syncStateTable } from "../../database/schema";
import { env } from "../../env";
import { logger } from "../../logger";
import type { SyncResult } from "../types";
import { upsertGeneratedPost } from "../upsert-post";
import {
  fetchPublicEvents,
  fetchPulls,
  fetchRepos,
  type GitHubEvent,
  type GitHubPull,
  type GitHubRepo,
} from "./client";
import { mapGitHubEvent } from "./map";

/** The settings keys that hold the cached snapshot and the featured set. */
export const GITHUB_OVERVIEW_KEY = "github:overview";
export const GITHUB_FEATURED_KEY = "github:featured";

const GITHUB_SOURCE = "github";
const ACTIVITY_DAYS = 90;
const MS_PER_DAY = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** What one sync writes under `github:overview`; `featured` is added on read. */
export type GitHubSnapshot = {
  activity: Array<{ count: number; date: string }>;
  languages: Record<string, number>;
  pulls: GitHubPull[];
  repos: Array<{
    description: string | null;
    forks: number;
    language: string | null;
    name: string;
    stars: number;
    updatedAt: string;
    url: string;
  }>;
  syncedAt: string;
};

const PULL_LIMIT = 30;

/**
 * How many commits one `PushEvent` represents.
 *
 * GitHub stopped sending `payload.size` on public events, so every push used
 * to count as zero and both `activity` and the old commit total read as a lie.
 * Fall back in order: `distinct_size`, the length of `commits`, then 1 — a
 * push is at minimum one push, even when the payload carries no detail at all.
 */
export function pushSize(event: GitHubEvent): number {
  const size = event.payload.size;
  if (typeof size === "number" && Number.isFinite(size)) {
    return size;
  }
  const distinct = event.payload.distinct_size;
  if (typeof distinct === "number" && Number.isFinite(distinct)) {
    return distinct;
  }
  const commits = event.payload.commits;
  if (Array.isArray(commits)) {
    return commits.length;
  }
  return 1;
}

function repoUrl(name: string): string {
  return `https://github.com/${name}`;
}

/**
 * A fetched repository is only usable when it carries a `name`; the filter
 * makes a malformed GitHub payload safe to snapshot instead of throwing.
 */
function isNamedRepo(repo: unknown): repo is GitHubRepo {
  return (
    typeof repo === "object" &&
    repo !== null &&
    typeof (repo as { name?: unknown }).name === "string"
  );
}

/**
 * Builds the cached repository snapshot. Forks are excluded from the list.
 */
function buildSnapshot(
  events: GitHubEvent[],
  rawRepos: GitHubRepo[],
  rawPulls: GitHubPull[],
  now: Date,
): GitHubSnapshot {
  const repos = rawRepos
    .filter(isNamedRepo)
    .filter((repo) => repo.fork !== true)
    .map((repo) => ({
      description:
        typeof repo.description === "string" ? repo.description : null,
      forks: typeof repo.forks_count === "number" ? repo.forks_count : 0,
      language: typeof repo.language === "string" ? repo.language : null,
      name: repo.name,
      stars:
        typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      updatedAt:
        typeof repo.updated_at === "string"
          ? repo.updated_at
          : now.toISOString(),
      url:
        typeof repo.html_url === "string" ? repo.html_url : repoUrl(repo.name),
    }));

  const languages: Record<string, number> = {};
  for (const repo of repos) {
    if (repo.language !== null) {
      languages[repo.language] = (languages[repo.language] ?? 0) + 1;
    }
  }

  const cutoff = new Date(
    now.getTime() - ACTIVITY_DAYS * MS_PER_DAY,
  ).toISOString();
  const cutoffDate = cutoff.slice(0, 10);
  const perDay = new Map<string, number>();

  for (const event of events) {
    if (event.type !== "PushEvent") {
      continue;
    }
    const size = pushSize(event);
    const date = event.created_at.slice(0, 10);
    if (DATE_PATTERN.test(date) && date >= cutoffDate) {
      perDay.set(date, (perDay.get(date) ?? 0) + size);
    }
  }

  const activity = [...perDay.entries()]
    .map(([date, count]) => ({ count, date }))
    .sort((left, right) => left.date.localeCompare(right.date));

  // The search endpoint already sorts by `updated`, but the snapshot must not
  // depend on that: sort defensively and keep only the newest 30.
  const pulls = [...rawPulls]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, PULL_LIMIT);

  return {
    activity,
    languages,
    pulls,
    repos,
    syncedAt: now.toISOString(),
  };
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ set: { value }, target: settingsTable.key });
}

async function readSetting(key: string): Promise<unknown> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

/** The `pulls` array of a previous snapshot, or none when it is unusable. */
function previousPulls(snapshot: unknown): GitHubPull[] {
  if (typeof snapshot !== "object" || snapshot === null) {
    return [];
  }
  const pulls = (snapshot as { pulls?: unknown }).pulls;
  return Array.isArray(pulls) ? (pulls as GitHubPull[]) : [];
}

async function writeSyncState(
  status: string,
  error: string | null,
): Promise<void> {
  const lastRunAt = new Date();
  await db
    .insert(syncStateTable)
    .values({
      lastError: error,
      lastRunAt,
      lastStatus: status,
      source: GITHUB_SOURCE,
    })
    .onConflictDoUpdate({
      set: { lastError: error, lastRunAt, lastStatus: status },
      target: syncStateTable.source,
    });
}

/**
 * Imports the user's public GitHub activity and caches a repository snapshot.
 * A failed run records the error in `sync_state` and leaves the last good
 * `github:overview` snapshot untouched.
 */
export async function syncGitHub(options: {
  fetchImpl?: typeof fetch;
  token?: string;
  username: string;
}): Promise<SyncResult> {
  try {
    const events = await fetchPublicEvents(
      options.username,
      options.token,
      options.fetchImpl,
    );
    const drafts = events.flatMap(mapGitHubEvent);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const draft of drafts) {
      const outcome = await upsertGeneratedPost(db, draft);
      if (outcome === "created") {
        created += 1;
      } else if (outcome === "updated") {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    const repos = await fetchRepos(
      options.username,
      options.token,
      options.fetchImpl,
    );

    // A search failure must not fail the run: the page keeps the pulls it
    // already had rather than blanking them.
    let pulls: GitHubPull[] | null = null;
    try {
      pulls = await fetchPulls(
        options.username,
        options.token,
        options.fetchImpl,
      );
    } catch (error) {
      logger.warn({ err: error }, "github pulls fetch failed; keeping cache");
    }
    const resolvedPulls =
      pulls ?? previousPulls(await readSetting(GITHUB_OVERVIEW_KEY));

    await writeSetting(
      GITHUB_OVERVIEW_KEY,
      buildSnapshot(events, repos, resolvedPulls, new Date()),
    );
    await writeSyncState("ok", null);

    return { created, error: null, skipped, updated };
  } catch (error) {
    const message = String(error).slice(0, 500);
    try {
      await writeSyncState("error", message);
    } catch (stateError) {
      // The database is unavailable; the caller must still get the documented
      // result shape instead of a rejection.
      logger.warn({ err: stateError }, "github sync state write failed");
    }
    return { created: 0, error: message, skipped: 0, updated: 0 };
  }
}

/**
 * Whether the last recorded run is old enough for a boot-time sync. A missing
 * or stale `lastRunAt` is due, so a fresh deploy and a long outage both recover
 * immediately; a recent run is skipped so a crash loop cannot burn the
 * unauthenticated hourly GitHub budget.
 */
async function isBootSyncDue(intervalMs: number): Promise<boolean> {
  const [row] = await db
    .select({ lastRunAt: syncStateTable.lastRunAt })
    .from(syncStateTable)
    .where(eq(syncStateTable.source, GITHUB_SOURCE))
    .limit(1);
  const lastRunAt = row?.lastRunAt;
  if (lastRunAt === null || lastRunAt === undefined) {
    return true;
  }
  return Date.now() - lastRunAt.getTime() >= intervalMs;
}

/**
 * Runs a sync on boot only when the last recorded run is older than the
 * interval, then every interval after that. The boot gate keeps a crash loop or
 * `bun --watch` from spending the GitHub rate limit; the timer is unref'd so it
 * never keeps the process alive, and tests never schedule.
 */
export function startGitHubScheduler(intervalMinutes: number): void {
  if (env.nodeEnv === "test") {
    return;
  }

  const intervalMs = intervalMinutes * 60_000;
  const run = () => {
    syncGitHub({
      token: env.github.token,
      username: env.github.username,
    }).catch((error: unknown) => {
      logger.warn({ err: error }, "github sync failed");
    });
  };

  void (async () => {
    try {
      if (await isBootSyncDue(intervalMs)) {
        run();
      }
    } catch (error) {
      logger.warn({ err: error }, "github sync due check failed");
    }
  })();
  const timer = setInterval(run, intervalMs);
  timer.unref();
}
