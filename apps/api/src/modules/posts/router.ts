import {
  adminPostListQuerySchema,
  postsListQuerySchema,
} from "@dasa122/contract";
import { type AnyProcedure, ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import {
  adminCreatePost,
  adminDeletePost,
  adminListPosts,
  adminPublishPost,
  adminUnpublishPost,
  adminUpdatePost,
  getPublishedPostBySlug,
  getRelatedPosts,
  listPublishedPosts,
} from "./service";

/** How many related posts the public post page shows. */
const RELATED_POSTS_LIMIT = 3;

/**
 * OpenAPI decodes query strings as strings, while the contract declares `limit`
 * and `year` as numbers. This preprocess converts the transport shape and then
 * validates with the contract schema itself, so the contract remains the only
 * source of request shapes.
 */
function coerceNumericQuery(
  schema: z.ZodType,
  keys: readonly string[],
): z.ZodType {
  return z.preprocess((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }
    const record = { ...(value as Record<string, unknown>) };
    for (const key of keys) {
      const entry = record[key];
      if (typeof entry === "string" && entry !== "") {
        record[key] = Number(entry);
      }
    }
    return record;
  }, schema);
}

/**
 * Swaps the validation schema on an already-implemented procedure. oRPC's
 * `implement()` builders do not expose `input()` (the contract owns it), so
 * this narrow transport adapter is the only place the query shape is widened.
 */
function withInputSchema<P extends AnyProcedure>(
  procedure: P,
  schema: z.ZodType,
): P {
  procedure["~orpc"].inputSchema = schema;
  return procedure;
}

const listInput = coerceNumericQuery(postsListQuerySchema, ["limit", "year"]);
const adminListInput = coerceNumericQuery(adminPostListQuerySchema, ["limit"]);

export const postsRouter = {
  bySlug: base.posts.bySlug.handler(async ({ input }) => {
    const post = await getPublishedPostBySlug(input.slug);
    if (post === null) {
      throw new ORPCError("NOT_FOUND", { message: "Post not found" });
    }
    return post;
  }),
  list: withInputSchema(
    base.posts.list.handler(({ input }) => listPublishedPosts(input)),
    listInput,
  ),
  related: base.posts.related.handler(async ({ input }) => {
    const items = await getRelatedPosts(input.slug, RELATED_POSTS_LIMIT);
    return { items, total: items.length };
  }),
};

export const adminPostsRouter = {
  create: base.adminPosts.create.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminCreatePost(input);
  }),
  delete: base.adminPosts.delete.handler(async ({ context, input }) => {
    await requireAdmin(context);
    await adminDeletePost(input.id);
    return { deleted: true };
  }),
  list: withInputSchema(
    base.adminPosts.list.handler(async ({ context, input }) => {
      await requireAdmin(context);
      return adminListPosts(input);
    }),
    adminListInput,
  ),
  publish: base.adminPosts.publish.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminPublishPost(input.id);
  }),
  unpublish: base.adminPosts.unpublish.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminUnpublishPost(input.id);
  }),
  update: base.adminPosts.update.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminUpdatePost(input.id, input);
  }),
};
