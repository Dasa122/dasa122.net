import { oc } from "@orpc/contract";
import z from "zod";
import { adminPostListQuerySchema } from "../domains/admin";
import {
  postCreateSchema,
  postDetailSchema,
  postSummarySchema,
  postUpdateSchema,
} from "../domains/posts";

const ADMIN_POSTS_TAGS = ["Admin / Posts"];

/** Every `{id}` action takes the id alone as its input. */
const idInputSchema = z.object({ id: z.uuid() });

export const adminPosts = {
  create: oc
    .route({
      description: "Create a draft post.",
      method: "POST",
      operationId: "postAdminPosts",
      path: "/admin/posts",
      tags: ADMIN_POSTS_TAGS,
    })
    .input(postCreateSchema)
    .output(postSummarySchema),
  delete: oc
    .route({
      description: "Delete a post.",
      method: "DELETE",
      operationId: "deleteAdminPostsById",
      path: "/admin/posts/{id}",
      tags: ADMIN_POSTS_TAGS,
    })
    .input(idInputSchema)
    .output(z.object({ deleted: z.boolean() })),
  list: oc
    .route({
      description: "List every post, drafts included, cursor-paginated.",
      method: "GET",
      operationId: "getAdminPosts",
      path: "/admin/posts",
      tags: ADMIN_POSTS_TAGS,
    })
    .input(adminPostListQuerySchema)
    .output(
      z.object({
        items: z.array(postDetailSchema),
        nextCursor: z.string().nullable(),
        total: z.number(),
      }),
    ),
  publish: oc
    .route({
      description: "Publish a post.",
      method: "POST",
      operationId: "postAdminPostsByIdPublish",
      path: "/admin/posts/{id}/publish",
      tags: ADMIN_POSTS_TAGS,
    })
    .input(idInputSchema)
    .output(postSummarySchema),
  unpublish: oc
    .route({
      description: "Turn a published post back into a draft.",
      method: "POST",
      operationId: "postAdminPostsByIdUnpublish",
      path: "/admin/posts/{id}/unpublish",
      tags: ADMIN_POSTS_TAGS,
    })
    .input(idInputSchema)
    .output(postSummarySchema),
  update: oc
    .route({
      description: "Patch a post.",
      method: "PATCH",
      operationId: "patchAdminPostsById",
      path: "/admin/posts/{id}",
      tags: ADMIN_POSTS_TAGS,
    })
    .input(postUpdateSchema)
    .output(postSummarySchema),
};
