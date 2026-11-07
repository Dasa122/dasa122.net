import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "../../database";
import { postsTable } from "../../database/schema";

export type PostRow = typeof postsTable.$inferSelect;
export type PostInsert = typeof postsTable.$inferInsert;
export type PostPatch = Partial<Omit<PostInsert, "createdAt" | "id">>;

/** Keyset cursor: the last row's ordering value plus its id as a tiebreaker. */
export type PostCursor = { at: Date; id: string };

type PublishedFilter = {
  before?: PostCursor | null;
  limit: number;
  q?: string;
  sources?: string[];
  tag?: string;
  year?: number;
};

type AdminFilter = {
  before?: PostCursor | null;
  limit: number;
  source?: string;
  status?: string;
};

/** Only published, non-future posts are public. */
function publishedConditions(): SQL[] {
  return [
    eq(postsTable.status, "published"),
    lte(postsTable.publishedAt, new Date()),
  ];
}

function beforeCondition(
  column: typeof postsTable.publishedAt | typeof postsTable.createdAt,
  cursor: PostCursor,
) {
  return sql`(${column}, ${postsTable.id}) < (${cursor.at}, ${cursor.id}::uuid)`;
}

/**
 * Public feed page. Fetches one extra row so the service can tell whether a
 * further page exists; `total` counts the whole filtered set.
 */
export async function listPublishedPostsRepo(
  executor: Database,
  filter: PublishedFilter,
): Promise<{ rows: PostRow[]; total: number }> {
  const conditions = [...publishedConditions()];

  if (filter.sources !== undefined && filter.sources.length > 0) {
    conditions.push(inArray(postsTable.source, filter.sources));
  }
  if (filter.tag !== undefined) {
    conditions.push(arrayContains(postsTable.tags, [filter.tag]));
  }
  if (filter.year !== undefined) {
    conditions.push(
      sql`extract(year from ${postsTable.publishedAt}) = ${filter.year}`,
    );
  }
  if (filter.q !== undefined) {
    const pattern = `%${filter.q}%`;
    const search = or(
      ilike(postsTable.title, pattern),
      ilike(postsTable.excerpt, pattern),
    );
    if (search !== undefined) {
      conditions.push(search);
    }
  }

  // The cursor paginates; it must not narrow the reported total.
  const filterWhere = and(...conditions);
  const pageWhere =
    filter.before !== undefined && filter.before !== null
      ? and(
          ...conditions,
          beforeCondition(postsTable.publishedAt, filter.before),
        )
      : filterWhere;

  const [totalRow] = await executor
    .select({ value: count() })
    .from(postsTable)
    .where(filterWhere);

  const rows = await executor
    .select()
    .from(postsTable)
    .where(pageWhere)
    .orderBy(desc(postsTable.publishedAt), desc(postsTable.id))
    .limit(filter.limit + 1);

  return { rows, total: totalRow?.value ?? 0 };
}

/** A published, non-future post by slug. Drafts and future posts are absent. */
export async function findPublishedBySlugRepo(
  executor: Database,
  slug: string,
): Promise<PostRow | null> {
  const [row] = await executor
    .select()
    .from(postsTable)
    .where(and(...publishedConditions(), eq(postsTable.slug, slug)))
    .limit(1);
  return row ?? null;
}

/**
 * The neighbours of a post in `published_at desc, id desc` order: `before` is
 * the newer row that precedes it and `after` is the older row that follows.
 */
export async function findPublishedNeighboursRepo(
  executor: Database,
  publishedAt: Date,
  id: string,
): Promise<{ after: PostRow | null; before: PostRow | null }> {
  const [before] = await executor
    .select()
    .from(postsTable)
    .where(
      and(
        ...publishedConditions(),
        sql`(${postsTable.publishedAt}, ${postsTable.id}) > (${publishedAt}, ${id}::uuid)`,
      ),
    )
    .orderBy(asc(postsTable.publishedAt), asc(postsTable.id))
    .limit(1);

  const [after] = await executor
    .select()
    .from(postsTable)
    .where(
      and(
        ...publishedConditions(),
        sql`(${postsTable.publishedAt}, ${postsTable.id}) < (${publishedAt}, ${id}::uuid)`,
      ),
    )
    .orderBy(desc(postsTable.publishedAt), desc(postsTable.id))
    .limit(1);

  return { after: after ?? null, before: before ?? null };
}

/** Published posts sharing at least one tag with `post`, newest first. */
export async function findRelatedRepo(
  executor: Database,
  post: PostRow,
  limit: number,
): Promise<PostRow[]> {
  if (post.tags.length === 0) {
    return [];
  }
  return executor
    .select()
    .from(postsTable)
    .where(
      and(
        ...publishedConditions(),
        ne(postsTable.id, post.id),
        arrayOverlaps(postsTable.tags, post.tags),
      ),
    )
    .orderBy(desc(postsTable.publishedAt), desc(postsTable.id))
    .limit(limit);
}

/** Admin list: drafts included, newest-created first. */
export async function adminListPostsRepo(
  executor: Database,
  filter: AdminFilter,
): Promise<{ rows: PostRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (filter.status !== undefined) {
    conditions.push(eq(postsTable.status, filter.status));
  }
  if (filter.source !== undefined) {
    conditions.push(eq(postsTable.source, filter.source));
  }

  // The cursor paginates; it must not narrow the reported total.
  const filterWhere = conditions.length > 0 ? and(...conditions) : undefined;
  const pageWhere =
    filter.before !== undefined && filter.before !== null
      ? and(...conditions, beforeCondition(postsTable.createdAt, filter.before))
      : filterWhere;

  const [totalRow] = await executor
    .select({ value: count() })
    .from(postsTable)
    .where(filterWhere);

  const rows = await executor
    .select()
    .from(postsTable)
    .where(pageWhere)
    .orderBy(desc(postsTable.createdAt), desc(postsTable.id))
    .limit(filter.limit + 1);

  return { rows, total: totalRow?.value ?? 0 };
}

export async function insertPostRepo(
  executor: Database,
  values: PostInsert,
): Promise<PostRow> {
  const [row] = await executor.insert(postsTable).values(values).returning();
  if (row === undefined) {
    throw new Error("post_insert_failed");
  }
  return row;
}

export async function updatePostRepo(
  executor: Database,
  id: string,
  values: PostPatch,
): Promise<PostRow | null> {
  const [row] = await executor
    .update(postsTable)
    .set(values)
    .where(eq(postsTable.id, id))
    .returning();
  return row ?? null;
}

export async function deletePostRepo(
  executor: Database,
  id: string,
): Promise<number> {
  const rows = await executor
    .delete(postsTable)
    .where(eq(postsTable.id, id))
    .returning({ id: postsTable.id });
  return rows.length;
}

export async function findPostByIdRepo(
  executor: Database,
  id: string,
): Promise<PostRow | null> {
  const [row] = await executor
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id))
    .limit(1);
  return row ?? null;
}

/** Whether another post already owns `slug` (optionally ignoring `excludeId`). */
export async function slugExistsRepo(
  executor: Database,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const conditions = [eq(postsTable.slug, slug)];
  if (excludeId !== undefined) {
    conditions.push(ne(postsTable.id, excludeId));
  }
  const [row] = await executor
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(...conditions))
    .limit(1);
  return row !== undefined;
}
