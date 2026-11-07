import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../database";
import { postsTable, syncStateTable } from "../../database/schema";
import { env } from "../../env";
import { logger } from "../../logger";
import { insertPostRepo, slugExistsRepo } from "../../modules/posts/repository";
import { type PostSummary, toSummary } from "../../modules/posts/service";
import { deriveExcerpt, readingTimeMinutes } from "../../util/excerpt";
import { slugify, uniqueSlug } from "../../util/slug";
import type { PostDraft, SyncResult } from "../types";
import {
  fetchLinkedInGrants,
  fetchLinkedInPosts,
  type LinkedInPost,
} from "./client";
import { type LinkedInConfig, resolveLinkedInTier } from "./tier";

export type LinkedInStatus = {
  message: string | null;
  scopes: string[];
  tier: "manual" | "active" | "insufficient_scope" | "unconfigured";
};

export type LinkedInOptions = {
  config?: LinkedInConfig;
  fetchImpl?: typeof fetch;
};

const LINKEDIN_SOURCE = "linkedin";
const TITLE_MAX_LENGTH = 200;

/**
 * The only explanation the admin gets for a dormant poller. These strings are
 * user-facing copy: the admin panel renders them verbatim.
 */
const STATUS_MESSAGES = {
  insufficient_scope:
    "The LinkedIn token does not carry r_member_social. Automatic sync stays inactive; publishing from the admin panel still works.",
  manual:
    "No LinkedIn access token configured. Publishing from the admin panel works; automatic sync is inactive.",
  unconfigured:
    "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable LinkedIn sync. Publishing from the admin panel works without them.",
} as const;

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

function messageFor(tier: LinkedInStatus["tier"]): string | null {
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

/** The fields a re-sync refreshes on an existing row. */
function updatedFields(draft: PostDraft) {
  return {
    externalUrl: draft.externalUrl,
    linkedinMeta: draft.linkedinMeta,
    title: draft.title,
    updatedAt: new Date(),
  };
}

/**
 * Persists one draft by `(source, external_id)`. This mirrors the GitHub
 * worker: the unique index makes a repeat sync an update, and the shared
 * `uniqueSlug` keeps a second post with a similar title from colliding.
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
 * The admin panel's tier view. Scopes are only looked up when a token exists,
 * and a transient lookup failure leaves the poller dormant rather than making
 * the panel a 500.
 */
export async function getLinkedInStatus(
  options: LinkedInOptions = {},
): Promise<LinkedInStatus> {
  const config = options.config ?? configFromEnv();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const token = config.accessToken?.trim() ?? "";

  if (resolveLinkedInTier(config, null) === "unconfigured" || token === "") {
    const tier = resolveLinkedInTier(config, null);
    return { message: messageFor(tier), scopes: [], tier };
  }

  let scopes: string[] | null = null;
  try {
    scopes = (await fetchLinkedInGrants(token, fetchImpl)).scopes;
  } catch (error) {
    logger.warn({ err: error }, "linkedin grant lookup failed");
  }

  const tier = resolveLinkedInTier(config, scopes);
  return { message: messageFor(tier), scopes: scopes ?? [], tier };
}

/**
 * Imports the member's LinkedIn posts. The poller is dormant unless the tier
 * resolves to `active`: the local tiers and a token without `r_member_social`
 * return an empty result, and the posts endpoint is never called.
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
    const grants = await fetchLinkedInGrants(token, fetchImpl);
    if (resolveLinkedInTier(config, grants.scopes) !== "active") {
      await recordSyncState("not_configured", null);
      return emptyResult();
    }

    const posts = await fetchLinkedInPosts(token, fetchImpl);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const post of posts) {
      const outcome = await persistDraft(toDraft(post));
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
