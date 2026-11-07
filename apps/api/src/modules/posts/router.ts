import { ORPCError } from "@orpc/server";
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

export const postsRouter = {
  bySlug: base.posts.bySlug.handler(async ({ input }) => {
    const post = await getPublishedPostBySlug(input.slug);
    if (post === null) {
      throw new ORPCError("NOT_FOUND", { message: "Post not found" });
    }
    return post;
  }),
  list: base.posts.list.handler(({ input }) => listPublishedPosts(input)),
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
  list: base.adminPosts.list.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminListPosts(input);
  }),
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
