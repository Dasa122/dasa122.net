import z from "zod";
import { githubRepoSchema } from "./github";
import { postSourceSchema, postStatusSchema } from "./posts";

/** The admin dashboard's numbers: post counts, a per-source breakdown, and
 * the sync state of every feed source. */
export const adminStatsSchema = z.object({
  bySource: z.record(z.string(), z.number().int()),
  drafts: z.number().int(),
  lastSync: z.array(
    z.object({
      lastError: z.string().nullable(),
      lastRunAt: z.iso.datetime().nullable(),
      lastStatus: z.string().nullable(),
      source: z.string(),
    }),
  ),
  published: z.number().int(),
});

/** Cursor-paginated query for the admin post list. */
export const adminPostListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  source: postSourceSchema.optional(),
  status: postStatusSchema.optional(),
});

/** Why automatic LinkedIn sync is (in)active. */
export const linkedInStatusSchema = z.object({
  message: z.string().nullable(),
  scopes: z.array(z.string()),
  tier: z.enum(["manual", "active", "insufficient_scope", "unconfigured"]),
});

/** A LinkedIn post published from the admin panel into the feed. */
export const adminLinkedInPublishSchema = z.object({
  body: z.string().min(1).max(5000),
  permalink: z.url(),
});

/** The GitHub admin panel: token presence, the cached repository snapshot,
 * and the last sync's state. Never triggers an outbound GitHub call. */
export const adminGithubStatusSchema = z.object({
  lastError: z.string().nullable(),
  lastRunAt: z.iso.datetime().nullable(),
  lastStatus: z.string().nullable(),
  repos: z.array(githubRepoSchema),
  tokenPresent: z.boolean(),
  username: z.string().nullable(),
});

/** The outcome of one sync worker run. */
export const adminSyncResponseSchema = z.object({
  created: z.number().int(),
  error: z.string().nullable(),
  skipped: z.number().int(),
  updated: z.number().int(),
});

/** The metadata of an uploaded image. */
export const mediaUploadSchema = z.object({
  bytes: z.number().int(),
  filename: z.string(),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/avif"]),
});
