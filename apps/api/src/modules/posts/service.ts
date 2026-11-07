import type {
  adminPostListQuerySchema,
  postCreateSchema,
  postDetailSchema,
  postSummarySchema,
  postsListQuerySchema,
  postUpdateSchema,
} from "@dasa122/contract";
import { ORPCError } from "@orpc/server";
import type { z } from "zod";
import { db } from "../../database";
import { deriveExcerpt, readingTimeMinutes } from "../../util/excerpt";
import { renderMarkdown } from "../../util/markdown";
import { slugify, uniqueSlug } from "../../util/slug";
import {
  adminListPostsRepo,
  deletePostRepo,
  findPostByIdRepo,
  findPublishedBySlugRepo,
  findPublishedNeighboursRepo,
  findRelatedRepo,
  insertPostRepo,
  listPublishedPostsRepo,
  type PostCursor,
  type PostPatch,
  type PostRow,
  slugExistsRepo,
  updatePostRepo,
} from "./repository";

export type PostSummary = z.infer<typeof postSummarySchema>;
export type PostDetail = z.infer<typeof postDetailSchema>;
export type PostCreateInput = z.infer<typeof postCreateSchema>;
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;
export type PostsListQuery = z.infer<typeof postsListQuerySchema>;
export type AdminPostListQuery = z.infer<typeof adminPostListQuerySchema>;

/** A post page plus the neighbours the reader can navigate to. */
export type PublishedPost = PostDetail & {
  next: PostSummary | null;
  prev: PostSummary | null;
};

export type PostsPage = {
  items: PostSummary[];
  nextCursor: string | null;
  total: number;
};

export type AdminPostsPage = {
  items: PostDetail[];
  nextCursor: string | null;
  total: number;
};

/** How many related posts the public post page requests. */
const RELATED_POSTS_LIMIT = 3;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSummary(row: PostRow): PostSummary {
  return {
    coverImage: row.coverImage,
    createdAt: row.createdAt.toISOString(),
    excerpt: row.excerpt,
    externalUrl: row.externalUrl,
    githubMeta: row.githubMeta,
    id: row.id,
    linkedinMeta: row.linkedinMeta,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    readTimeMin: row.readTimeMin,
    slug: row.slug,
    source: row.source as PostSummary["source"],
    status: row.status as PostSummary["status"],
    tags: row.tags,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: PostRow, bodyHtml: string | null): PostDetail {
  return { ...toSummary(row), body: row.body, bodyHtml };
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return atob(normalized.padEnd(normalized.length + padding, "="));
}

function encodeCursor(at: Date, id: string): string {
  return base64UrlEncode(`${at.toISOString()}|${id}`);
}

function decodeCursor(cursor: string): PostCursor | null {
  try {
    const raw = base64UrlDecode(cursor);
    const separator = raw.lastIndexOf("|");
    if (separator <= 0) {
      return null;
    }
    const at = new Date(raw.slice(0, separator));
    const id = raw.slice(separator + 1);
    if (Number.isNaN(at.getTime()) || !UUID_PATTERN.test(id)) {
      return null;
    }
    return { at, id };
  } catch {
    return null;
  }
}

function notFound() {
  return new ORPCError("NOT_FOUND", { message: "Post not found" });
}

function linkedinMeta(
  source: PostCreateInput["source"],
  permalink: string | null,
): PostRow["linkedinMeta"] {
  if (source !== "linkedin" || permalink === null) {
    return null;
  }
  return { permalink, postedAt: null };
}

/** Creates a draft. The excerpt and reading time are derived from the body. */
export async function adminCreatePost(
  input: PostCreateInput,
): Promise<PostSummary> {
  const row = await insertPostRepo(db, {
    body: input.body,
    coverImage: input.coverImage,
    excerpt: input.excerpt ?? deriveExcerpt(input.body ?? ""),
    externalUrl: input.externalUrl,
    linkedinMeta: linkedinMeta(input.source, input.linkedinPermalink),
    readTimeMin: readingTimeMinutes(input.body ?? ""),
    slug: input.slug,
    source: input.source,
    status: "draft",
    tags: input.tags,
    title: input.title,
  });
  return toSummary(row);
}

/** Applies only the provided fields; a changed body regenerates the excerpt. */
export async function adminUpdatePost(
  id: string,
  input: PostUpdateInput,
): Promise<PostSummary> {
  const patch: PostPatch = {};

  if (input.title !== undefined) {
    patch.title = input.title;
  }
  if (input.body !== undefined) {
    patch.body = input.body;
    patch.readTimeMin = readingTimeMinutes(input.body ?? "");
  }
  if (input.excerpt !== undefined) {
    patch.excerpt = input.excerpt;
  } else if (input.body !== undefined) {
    patch.excerpt = deriveExcerpt(input.body ?? "");
  }
  if (input.coverImage !== undefined) {
    patch.coverImage = input.coverImage;
  }
  if (input.externalUrl !== undefined) {
    patch.externalUrl = input.externalUrl;
  }
  if (input.slug !== undefined) {
    patch.slug = input.slug;
  }
  if (input.tags !== undefined) {
    patch.tags = input.tags;
  }
  if (input.source !== undefined) {
    patch.source = input.source;
  }
  if (input.linkedinPermalink !== undefined) {
    patch.linkedinMeta = linkedinMeta(
      input.source ?? "linkedin",
      input.linkedinPermalink,
    );
  }
  patch.updatedAt = new Date();

  const row = await updatePostRepo(db, id, patch);
  if (row === null) {
    throw notFound();
  }
  return toSummary(row);
}

export async function adminDeletePost(id: string): Promise<void> {
  const deleted = await deletePostRepo(db, id);
  if (deleted === 0) {
    throw notFound();
  }
}

/**
 * Publishes a post, assigning a unique slug. A post that already carries a
 * slug keeps it as the base; otherwise the title is slugified.
 */
export async function adminPublishPost(
  id: string,
  publishedAt: Date = new Date(),
): Promise<PostSummary> {
  const post = await findPostByIdRepo(db, id);
  if (post === null) {
    throw notFound();
  }

  const base = post.slug ?? (slugify(post.title) || "post");
  const slug = await uniqueSlug(base, (candidate) =>
    slugExistsRepo(db, candidate, id),
  );

  const row = await updatePostRepo(db, id, {
    publishedAt,
    slug,
    status: "published",
    updatedAt: new Date(),
  });
  if (row === null) {
    throw notFound();
  }
  return toSummary(row);
}

/** Returns a post to draft and frees its slug so it can be reused. */
export async function adminUnpublishPost(id: string): Promise<PostSummary> {
  const row = await updatePostRepo(db, id, {
    publishedAt: null,
    slug: null,
    status: "draft",
    updatedAt: new Date(),
  });
  if (row === null) {
    throw notFound();
  }
  return toSummary(row);
}

/** The public feed: published, non-future posts, newest first. */
export async function listPublishedPosts(
  query: PostsListQuery,
): Promise<PostsPage> {
  const before = query.cursor === undefined ? null : decodeCursor(query.cursor);
  const { rows, total } = await listPublishedPostsRepo(db, {
    before,
    limit: query.limit,
    q: query.q,
    sources: query.sources,
    tag: query.tag,
    year: query.year,
  });

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const lastPublishedAt = last?.publishedAt ?? null;
  return {
    items: page.map(toSummary),
    nextCursor:
      rows.length > query.limit &&
      last !== undefined &&
      lastPublishedAt !== null
        ? encodeCursor(lastPublishedAt, last.id)
        : null,
    total,
  };
}

/** The admin list: every post, drafts included, bodyHtml never rendered. */
export async function adminListPosts(
  query: AdminPostListQuery,
): Promise<AdminPostsPage> {
  const before = query.cursor === undefined ? null : decodeCursor(query.cursor);
  const { rows, total } = await adminListPostsRepo(db, {
    before,
    limit: query.limit,
    source: query.source,
    status: query.status,
  });

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => toDetail(row, null)),
    nextCursor:
      rows.length > query.limit && last !== undefined
        ? encodeCursor(last.createdAt, last.id)
        : null,
    total,
  };
}

/** Published posts sharing a tag, newest first. */
export async function getRelatedPosts(
  slug: string,
  limit: number = RELATED_POSTS_LIMIT,
): Promise<PostSummary[]> {
  const post = await findPublishedBySlugRepo(db, slug);
  if (post === null) {
    return [];
  }
  return (await findRelatedRepo(db, post, limit)).map(toSummary);
}

/**
 * One published post by slug. Returns `null` for a missing, draft or
 * future-dated post; `bodyHtml` is rendered here and only here.
 */
export async function getPublishedPostBySlug(
  slug: string,
): Promise<PublishedPost | null> {
  const row = await findPublishedBySlugRepo(db, slug);
  if (row === null) {
    return null;
  }

  const bodyHtml = row.body === null ? null : await renderMarkdown(row.body);

  let next: PostSummary | null = null;
  let prev: PostSummary | null = null;
  if (row.publishedAt !== null) {
    const neighbours = await findPublishedNeighboursRepo(
      db,
      row.publishedAt,
      row.id,
    );
    next = neighbours.after === null ? null : toSummary(neighbours.after);
    prev = neighbours.before === null ? null : toSummary(neighbours.before);
  }

  return { ...toDetail(row, bodyHtml), next, prev };
}
