import {
  adminPostListQuerySchema,
  postCreateSchema,
  type postDetailSchema,
  type postSummarySchema,
  postUpdateSchema,
} from "@dasa122/contract";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import type { ApiClient } from "../client";
import { stripUndefined, toQuery } from "./input";
import { errorResult, textResult } from "./result";

export type PostSummary = z.infer<typeof postSummarySchema>;
export type PostDetail = z.infer<typeof postDetailSchema>;

type AdminPostsPage = {
  items: PostDetail[];
  nextCursor: string | null;
  total: number;
};

export const listInputSchema = z.object({
  cursor: adminPostListQuerySchema.shape.cursor.describe(
    "Opaque cursor returned as nextCursor by a previous page.",
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Page size, 1–50. Defaults to 20."),
  source: adminPostListQuerySchema.shape.source.describe(
    "Filter by provenance: own, github or linkedin.",
  ),
  status: adminPostListQuerySchema.shape.status.describe(
    "Filter by status: draft or published.",
  ),
});

export const createInputSchema = z.object({
  body: postCreateSchema.shape.body.describe(
    "Markdown body; null for link-only posts.",
  ),
  coverImage: postCreateSchema.shape.coverImage.describe(
    "Cover image URL or /api/media path.",
  ),
  excerpt: postCreateSchema.shape.excerpt.describe(
    "Short summary, at most 400 characters.",
  ),
  externalUrl: postCreateSchema.shape.externalUrl.describe(
    "Canonical external URL for the post.",
  ),
  linkedinPermalink: postCreateSchema.shape.linkedinPermalink.describe(
    "LinkedIn permalink when the source is linkedin.",
  ),
  slug: postCreateSchema.shape.slug.describe(
    "URL slug, at most 120 characters; derived from the title when omitted.",
  ),
  source: postCreateSchema.shape.source.describe(
    "Provenance: own for hand-written posts, linkedin for mirrored ones.",
  ),
  tags: postCreateSchema.shape.tags.describe(
    "Up to 12 tags, each at most 48 characters.",
  ),
  title: postCreateSchema.shape.title.describe("Post title, 1–200 characters."),
});

export const updateInputSchema = z.object({
  body: postUpdateSchema.shape.body.describe(
    "Replacement markdown body; omit to leave it unchanged.",
  ),
  coverImage: postUpdateSchema.shape.coverImage.describe(
    "Replacement cover image URL; omit to leave it unchanged.",
  ),
  excerpt: postUpdateSchema.shape.excerpt.describe(
    "Replacement summary; omit to leave it unchanged.",
  ),
  externalUrl: postUpdateSchema.shape.externalUrl.describe(
    "Replacement external URL; omit to leave it unchanged.",
  ),
  id: postUpdateSchema.shape.id.describe("Id of the post to patch (UUID)."),
  linkedinPermalink: postUpdateSchema.shape.linkedinPermalink.describe(
    "Replacement LinkedIn permalink; omit to leave it unchanged.",
  ),
  slug: postUpdateSchema.shape.slug.describe(
    "Replacement URL slug; omit to leave it unchanged.",
  ),
  source: postUpdateSchema.shape.source.describe(
    "Replacement provenance; omit to leave it unchanged.",
  ),
  tags: postUpdateSchema.shape.tags.describe(
    "Replacement tag list; omit to leave it unchanged.",
  ),
  title: postUpdateSchema.shape.title.describe(
    "Replacement title; omit to leave it unchanged.",
  ),
});

export const idInputSchema = z.object({
  id: postUpdateSchema.shape.id.describe("Id of the post (UUID)."),
});

export type ListInput = z.infer<typeof listInputSchema>;
export type CreateInput = z.infer<typeof createInputSchema>;
export type UpdateInput = z.infer<typeof updateInputSchema>;

/** GET /admin/posts — drafts included, cursor-paginated. */
export async function newsList(client: ApiClient, input: ListInput) {
  try {
    const query = toQuery({
      cursor: input.cursor,
      limit: input.limit,
      source: input.source,
      status: input.status,
    });
    const page = await client.request<AdminPostsPage>(
      "GET",
      `/admin/posts${query}`,
    );
    const lines = page.items.map(
      (post) => `- [${post.status}] ${post.title} — ${post.source}, ${post.id}`,
    );
    const more =
      page.nextCursor === null
        ? ""
        : `\nMore available (${page.total} total): pass nextCursor "${page.nextCursor}".`;
    const text = `Admin posts: showing ${page.items.length} of ${page.total}.${
      lines.length === 0 ? "" : `\n${lines.join("\n")}`
    }${more}`;
    return textResult(text, { ...page });
  } catch (error) {
    return errorResult(error);
  }
}

/** POST /admin/posts — creates a draft. */
export async function newsCreate(client: ApiClient, input: CreateInput) {
  try {
    const post = await client.request<PostSummary>(
      "POST",
      "/admin/posts",
      input,
    );
    return textResult(
      `Created ${post.status} post "${post.title}" (${post.id}).`,
      { ...post },
    );
  } catch (error) {
    return errorResult(error);
  }
}

/** PATCH /admin/posts/{id} — the id travels in the path, the patch in the body. */
export async function newsUpdate(client: ApiClient, input: UpdateInput) {
  try {
    const { id, ...patch } = input;
    const post = await client.request<PostSummary>(
      "PATCH",
      `/admin/posts/${encodeURIComponent(id)}`,
      stripUndefined(patch),
    );
    return textResult(`Updated post "${post.title}" (${post.id}).`, {
      ...post,
    });
  } catch (error) {
    return errorResult(error);
  }
}

/** POST /admin/posts/{id}/publish */
export async function newsPublish(
  client: ApiClient,
  input: z.infer<typeof idInputSchema>,
) {
  try {
    const post = await client.request<PostSummary>(
      "POST",
      `/admin/posts/${encodeURIComponent(input.id)}/publish`,
    );
    return textResult(`Published "${post.title}" (${post.id}).`, { ...post });
  } catch (error) {
    return errorResult(error);
  }
}

/** POST /admin/posts/{id}/unpublish — removes the public page. */
export async function newsUnpublish(
  client: ApiClient,
  input: z.infer<typeof idInputSchema>,
) {
  try {
    const post = await client.request<PostSummary>(
      "POST",
      `/admin/posts/${encodeURIComponent(input.id)}/unpublish`,
    );
    return textResult(
      `Unpublished "${post.title}" (${post.id}); it is a draft again.`,
      { ...post },
    );
  } catch (error) {
    return errorResult(error);
  }
}

/** DELETE /admin/posts/{id} */
export async function newsDelete(
  client: ApiClient,
  input: z.infer<typeof idInputSchema>,
) {
  try {
    const result = await client.request<{ deleted: boolean }>(
      "DELETE",
      `/admin/posts/${encodeURIComponent(input.id)}`,
    );
    return textResult(
      result.deleted
        ? `Deleted post ${input.id}.`
        : `The API did not delete post ${input.id}.`,
      { ...result, id: input.id },
    );
  } catch (error) {
    return errorResult(error);
  }
}

/** Registers the news tools on the MCP server. */
export function registerNewsTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "dasa_news_list",
    {
      annotations: { readOnlyHint: true },
      description:
        "List news posts from dasa122.net, drafts included, newest first. Returns items, the total count, and a nextCursor when more pages exist.",
      inputSchema: listInputSchema,
      title: "List news posts",
    },
    (input) => newsList(client, input),
  );

  server.registerTool(
    "dasa_news_create",
    {
      description:
        "Create a draft news post on dasa122.net. Use source own for hand-written posts or linkedin for mirrored ones; GitHub posts are sync-only.",
      inputSchema: createInputSchema,
      title: "Create news post",
    },
    (input) => newsCreate(client, input),
  );

  server.registerTool(
    "dasa_news_update",
    {
      annotations: { idempotentHint: true },
      description:
        "Patch an existing news post. Only the fields you supply are sent, so omitted fields keep their current values.",
      inputSchema: updateInputSchema,
      title: "Update news post",
    },
    (input) => newsUpdate(client, input),
  );

  server.registerTool(
    "dasa_news_publish",
    {
      annotations: { idempotentHint: true },
      description:
        "Publish a draft news post, making it visible on the public site.",
      inputSchema: idInputSchema,
      title: "Publish news post",
    },
    (input) => newsPublish(client, input),
  );

  server.registerTool(
    "dasa_news_unpublish",
    {
      annotations: { destructiveHint: true },
      description:
        "Turn a published news post back into a draft, removing its public page.",
      inputSchema: idInputSchema,
      title: "Unpublish news post",
    },
    (input) => newsUnpublish(client, input),
  );

  server.registerTool(
    "dasa_news_delete",
    {
      annotations: { destructiveHint: true },
      description:
        "Permanently delete a news post. This cannot be undone; prefer unpublish when you only want to hide it.",
      inputSchema: idInputSchema,
      title: "Delete news post",
    },
    (input) => newsDelete(client, input),
  );
}
