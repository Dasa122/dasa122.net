import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "../../database";
import { settingsTable, syncStateTable } from "../../database/schema";
import { env } from "../../env";
import { logger } from "../../logger";
import { insertPostRepo, slugExistsRepo } from "../../modules/posts/repository";
import { type PostSummary, toSummary } from "../../modules/posts/service";
import { deriveExcerpt, readingTimeMinutes } from "../../util/excerpt";
import { slugify, uniqueSlug } from "../../util/slug";
import type { PostDraft, SyncResult } from "../types";
import { upsertGeneratedPost } from "../upsert-post";
import {
  fetchLinkedInPosts,
  type LinkedInPost,
  type LinkedInProbe,
  probeLinkedInTier,
} from "./client";
import {
  type LinkedInConfig,
  type LinkedInTier,
  resolveLinkedInTier,
} from "./tier";

export type LinkedInStatus = {
  message: string | null;
  scopes: string[];
  tier: LinkedInTier;
};

export type LinkedInOptions = {
  config?: LinkedInConfig;
  fetchImpl?: typeof fetch;
};

type CachedTier = Exclude<LinkedInTier, "unconfigured">;

type LinkedInTierCache = {
  checkedAt: string;
  error: string | null;
  scopes: string[] | null;
  tier: CachedTier;
};

const LINKEDIN_SOURCE = "linkedin";

/** The `settings` key that caches the last `/rest/posts` probe. */
export const LINKEDIN_TIER_KEY = "linkedin:tier";

const TITLE_MAX_LENGTH = 200;

/**
 * The explanation the admin gets when the tier is resolvable without a probe.
 * These strings are user-facing copy: the admin panel renders them verbatim.
 */
const STATUS_MESSAGES = {
  insufficient_scope:
    "The LinkedIn token does not carry r_member_social. Automatic sync stays inactive; publishing from the admin panel still works.",
  manual:
    "No LinkedIn access token configured. Publishing from the admin panel works; automatic sync is inactive.",
  unconfigured:
    "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable LinkedIn sync. Publishing from the admin panel works without them.",
} as const;

/** A token is configured but no probe has run yet: say so, don't guess. */
const PENDING_MESSAGE =
  "The LinkedIn token has not been checked yet. Automatic sync activates on the next scheduled check.";

/** The probe reached LinkedIn but could not confirm the token. */
const CHECK_FAILED_MESSAGE =
  "The LinkedIn check failed. Automatic sync stays inactive; publishing from the admin panel still works.";

function configFromEnv(): LinkedInConfig {
  return {
    accessToken: env.linkedin.accessToken,
    clientId: env.linkedin.clientId,
    clientSecret: env.linkedin.clientSecret,
  };
}

function emptyResult(): SyncResult {
  return { created: 0, error: null, skipped: 0, updated: 0 };
}

function messageFor(tier: LinkedInTier): string | null {
  return tier === "active" ? null : STATUS_MESSAGES[tier];
}

function firstLine(text: string): string {
  return (text.split("\n")[0] ?? "").trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseTierCache(value: unknown): LinkedInTierCache | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const tier = record.tier;
  if (tier !== "manual" && tier !== "active" && tier !== "insufficient_scope") {
    return null;
  }
  const checkedAt =
    typeof record.checkedAt === "string" ? record.checkedAt : null;
  if (checkedAt === null) {
    return null;
  }
  return {
    checkedAt,
    error: typeof record.error === "string" ? record.error : null,
    scopes: Array.isArray(record.scopes)
      ? record.scopes.filter(
          (scope): scope is string => typeof scope === "string",
        )
      : null,
    tier,
  };
}

async function readTierCache(): Promise<LinkedInTierCache | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, LINKEDIN_TIER_KEY))
    .limit(1);
  return parseTierCache(row?.value);
}

/** The cache is an optimisation; a failed write must not fail the sync. */
async function recordTierCache(probe: LinkedInProbe): Promise<void> {
  const value = {
    checkedAt: new Date().toISOString(),
    error: probe.error,
    scopes: probe.scopes,
    tier: probe.tier,
  };
  try {
    await db
      .insert(settingsTable)
      .values({ key: LINKEDIN_TIER_KEY, value })
      .onConflictDoUpdate({
        set: { value },
        target: settingsTable.key,
      });
  } catch (error) {
    logger.warn({ err: error }, "linkedin tier cache write failed");
  }
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
      source: LINKEDIN_SOURCE,
    })
    .onConflictDoUpdate({
      set: { lastError: error, lastRunAt, lastStatus: status },
      target: syncStateTable.source,
    });
}

/** A failed state write must never replace the documented sync result. */
async function recordSyncState(
  status: string,
  error: string | null,
): Promise<void> {
  try {
    await writeSyncState(status, error);
  } catch (stateError) {
    logger.warn({ err: stateError }, "linkedin sync state write failed");
  }
}

function toDraft(post: LinkedInPost): PostDraft {
  return {
    body: post.text,
    excerpt: null,
    externalId: post.id,
    externalUrl: post.permalink,
    githubMeta: null,
    linkedinMeta: {
      permalink: post.permalink,
      postedAt: post.publishedAt.toISOString(),
    },
    publishedAt: post.publishedAt,
    source: "linkedin",
    tags: [],
    title: firstLine(post.text).slice(0, TITLE_MAX_LENGTH),
  };
}

/**
 * The admin panel's tier view. Reads the cached probe only: opening the panel
 * never costs a LinkedIn request.
 */
export async function getLinkedInStatus(
  options: LinkedInOptions = {},
): Promise<LinkedInStatus> {
  const config = options.config ?? configFromEnv();

  if (resolveLinkedInTier(config, null) === "unconfigured") {
    return {
      message: messageFor("unconfigured"),
      scopes: [],
      tier: "unconfigured",
    };
  }

  const token = config.accessToken?.trim() ?? "";
  if (token === "") {
    return { message: messageFor("manual"), scopes: [], tier: "manual" };
  }

  const cached = await readTierCache();
  if (cached === null) {
    return { message: PENDING_MESSAGE, scopes: [], tier: "manual" };
  }
  if (cached.tier === "active") {
    return { message: null, scopes: cached.scopes ?? [], tier: "active" };
  }
  if (cached.tier === "insufficient_scope") {
    return {
      message: messageFor("insufficient_scope"),
      scopes: cached.scopes ?? [],
      tier: "insufficient_scope",
    };
  }
  return {
    message: CHECK_FAILED_MESSAGE,
    scopes: cached.scopes ?? [],
    tier: "manual",
  };
}

/**
 * Imports the member's LinkedIn posts. `/rest/posts` is the tier authority:
 * the probe runs first and its outcome is cached. Only an `active` probe is
 * followed by an import, and an unconfigured or token-less setup makes no
 * request at all.
 */
export async function syncLinkedIn(
  options: LinkedInOptions = {},
): Promise<SyncResult> {
  const config = options.config ?? configFromEnv();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const token = config.accessToken?.trim() ?? "";

  if (resolveLinkedInTier(config, null) === "unconfigured" || token === "") {
    await recordSyncState("not_configured", null);
    return emptyResult();
  }

  try {
    const probe = await probeLinkedInTier(token, fetchImpl);
    await recordTierCache(probe);
    if (probe.tier !== "active") {
      await recordSyncState("not_configured", null);
      return emptyResult();
    }

    const posts = await fetchLinkedInPosts(token, fetchImpl);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const post of posts) {
      const outcome = await upsertGeneratedPost(db, toDraft(post));
      if (outcome === "created") {
        created += 1;
      } else if (outcome === "updated") {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    await writeSyncState("ok", null);
    return { created, error: null, skipped, updated };
  } catch (error) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 500);
    await recordSyncState("error", message);
    return { created: 0, error: message, skipped: 0, updated: 0 };
  }
}

/**
 * Whether the last recorded run is old enough for a boot-time sync, so a
 * restart storm cannot hammer the endpoint.
 */
async function isBootSyncDue(intervalMs: number): Promise<boolean> {
  const [row] = await db
    .select({ lastRunAt: syncStateTable.lastRunAt })
    .from(syncStateTable)
    .where(eq(syncStateTable.source, LINKEDIN_SOURCE))
    .limit(1);
  const lastRunAt = row?.lastRunAt;
  if (lastRunAt === null || lastRunAt === undefined) {
    return true;
  }
  return Date.now() - lastRunAt.getTime() >= intervalMs;
}

/**
 * Runs the LinkedIn poller on boot (when due) and then every interval. With no
 * access token it returns immediately and never touches the network; under
 * tests it never schedules. The timer is unref'd so it cannot keep the process
 * alive.
 */
export function startLinkedInScheduler(intervalMinutes: number): void {
  if (env.nodeEnv === "test") {
    return;
  }
  if (env.linkedin.accessToken.trim() === "") {
    return;
  }

  const intervalMs = intervalMinutes * 60_000;
  const run = () => {
    syncLinkedIn().catch((error: unknown) => {
      logger.warn({ err: error }, "linkedin sync failed");
    });
  };

  void (async () => {
    try {
      if (await isBootSyncDue(intervalMs)) {
        run();
      }
    } catch (error) {
      logger.warn({ err: error }, "linkedin sync due check failed");
    }
  })();
  const timer = setInterval(run, intervalMs);
  timer.unref();
}

/**
 * Publishes a pasted LinkedIn post directly into the feed. Tier 1 works with
 * no credentials at all; the permalink is the only link to LinkedIn.
 */
export async function publishLinkedInPost(input: {
  body: string;
  permalink: string;
}): Promise<PostSummary> {
  if (!isHttpUrl(input.permalink)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Permalink must be an absolute http(s) URL",
    });
  }

  const now = new Date();
  const title = firstLine(input.body).slice(0, TITLE_MAX_LENGTH);
  const slug = await uniqueSlug(slugify(title), (candidate) =>
    slugExistsRepo(db, candidate),
  );

  const row = await insertPostRepo(db, {
    body: input.body,
    excerpt: deriveExcerpt(input.body),
    externalUrl: input.permalink,
    linkedinMeta: {
      permalink: input.permalink,
      postedAt: now.toISOString(),
    },
    publishedAt: now,
    readTimeMin: readingTimeMinutes(input.body),
    slug,
    source: "linkedin",
    status: "published",
    tags: [],
    title,
  });
  return toSummary(row);
}
