import { oc } from "@orpc/contract";
import { listResponse } from "../domains/common";
import {
  postBySlugSchema,
  postDetailSchema,
  postRelatedSchema,
  postSummarySchema,
  postsListQuerySchema,
  postsListResponseSchema,
} from "../domains/posts";

const POSTS_TAGS = ["Posts"];

export const posts = {
  bySlug: oc
    .route({
      description: "Fetch one published post by slug, with its neighbours.",
      method: "GET",
      operationId: "getPostsBySlug",
      path: "/posts/{slug}",
      tags: POSTS_TAGS,
    })
    .input(postBySlugSchema)
    .output(
      postDetailSchema.extend({
        next: postSummarySchema.nullable(),
        prev: postSummarySchema.nullable(),
      }),
    ),
  list: oc
    .route({
      description: "List published posts, cursor-paginated.",
      method: "GET",
      operationId: "getPosts",
      path: "/posts",
      tags: POSTS_TAGS,
    })
    .input(postsListQuerySchema)
    .output(postsListResponseSchema),
  related: oc
    .route({
      description: "List published posts sharing at least one tag.",
      method: "GET",
      operationId: "getPostsBySlugRelated",
      path: "/posts/{slug}/related",
      tags: POSTS_TAGS,
    })
    .input(postRelatedSchema)
    .output(listResponse(postSummarySchema)),
};
