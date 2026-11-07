import { and, eq } from "drizzle-orm";
import { db } from "../../database";
import {
  postsTable,
  settingsTable,
  syncStateTable,
} from "../../database/schema";
import { env } from "../../env";
import { logger } from "../../logger";
import { slugExistsRepo } from "../../modules/posts/repository";
import { deriveExcerpt } from "../../util/excerpt";
import { slugify, uniqueSlug } from "../../util/slug";
import type { PostDraft, SyncResult } from "../types";
import {
  fetchPublicEvents,
  fetchRepos,
  type GitHubEvent,
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
  totalCommits: number;
};

function pushSize(event: GitHubEvent): number {
  const size = event.payload.size;
  return typeof size === "number" && Number.isFinite(size) ? size : 0;
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
  let totalCommits = 0;

  for (const event of events) {
    if (event.type !== "PushEvent") {
      continue;
    }
    const size = pushSize(event);
    totalCommits += size;
    const date = event.created_at.slice(0, 10);
    if (DATE_PATTERN.test(date) && date >= cutoffDate) {
      perDay.set(date, (perDay.get(date) ?? 0) + size);
    }
  }

  const activity = [...perDay.entries()]
    .map(([date, count]) => ({ count, date }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    activity,
    languages,
    repos,
    syncedAt: now.toISOString(),
    totalCommits,
  };
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ set: { value }, target: settingsTable.key });
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

/** The fields a re-sync refreshes on an existing row. */
function updatedFields(draft: PostDraft) {
  return {
    externalUrl: draft.externalUrl,
    githubMeta: draft.githubMeta,
    title: draft.title,
    updatedAt: new Date(),
  };
}

/**
 * Persists one draft. `external_id` plus the database's unique index make this
 * idempotent: a second run updates the row instead of inserting another. A
 * title with no alphanumerics cannot produce a slug and is skipped.
 */
async function persistDraft(
  draft: PostDraft,
): Promise<"created" | "skipped" | "updated"> {
  const base = slugify(draft.title);
  if (base === "") {
    return "skipped";
  }

  const [existing] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.source, draft.source),
        eq(postsTable.externalId, draft.externalId),
      ),
    )
    .limit(1);

  if (existing !== undefined) {
    await db
      .update(postsTable)
      .set(updatedFields(draft))
      .where(eq(postsTable.id, existing.id));
    return "updated";
  }

  const slug = await uniqueSlug(base, (candidate) =>
    slugExistsRepo(db, candidate),
  );
  const [inserted] = await db
    .insert(postsTable)
    .values({
      body: draft.body,
      excerpt: deriveExcerpt(draft.title),
      externalId: draft.externalId,
      externalUrl: draft.externalUrl,
      githubMeta: draft.githubMeta,
      linkedinMeta: draft.linkedinMeta,
      publishedAt: draft.publishedAt,
      readTimeMin: 1,
      slug,
      source: draft.source,
      status: "published",
      tags: draft.tags,
      title: draft.title,
    })
    .onConflictDoNothing({
      target: [postsTable.source, postsTable.externalId],
    })
    .returning({ id: postsTable.id });

  if (inserted !== undefined) {
    return "created";
  }

  // An overlapping run inserted the same external id first; refresh that row.
  await db
    .update(postsTable)
    .set(updatedFields(draft))
    .where(
      and(
        eq(postsTable.source, draft.source),
        eq(postsTable.externalId, draft.externalId),
      ),
    );
  return "updated";
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
      const outcome = await persistDraft(draft);
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
    await writeSetting(
      GITHUB_OVERVIEW_KEY,
      buildSnapshot(events, repos, new Date()),
    );
    await writeSyncState("ok", null);

    return { created, error: null, skipped, updated };
  } catch (error) {
    const message = String(error).slice(0, 500);
    await writeSyncState("error", message);
    return { created: 0, error: message, skipped: 0, updated: 0 };
  }
}

/**
 * Runs one sync immediately and then on the configured interval. The timer is
 * unref'd so it never keeps the process alive, and tests never schedule.
 */
export function startGitHubScheduler(intervalMinutes: number): void {
  if (env.nodeEnv === "test") {
    return;
  }

  const run = () => {
    syncGitHub({
      token: env.github.token,
      username: env.github.username,
    }).catch((error: unknown) => {
      logger.warn({ err: error }, "github sync failed");
    });
  };

  run();
  const timer = setInterval(run, intervalMinutes * 60_000);
  timer.unref();
}
