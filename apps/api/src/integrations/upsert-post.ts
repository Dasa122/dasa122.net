import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { postsTable } from "../database/schema";
import { slugExistsRepo } from "../modules/posts/repository";
import { deriveExcerpt } from "../util/excerpt";
import { slugify, uniqueSlug } from "../util/slug";
import type { PostDraft } from "./types";

/** The fields a re-sync refreshes on an existing row. */
function updatedFields(draft: PostDraft) {
  return {
    externalUrl: draft.externalUrl,
    githubMeta: draft.githubMeta,
    linkedinMeta: draft.linkedinMeta,
    title: draft.title,
    updatedAt: new Date(),
  };
}

/**
 * Persists one generated feed item by `(source, external_id)`. The lookup and
 * the unique index make this idempotent: a second run updates the row instead
 * of inserting another. A title with no alphanumerics cannot produce a slug
 * and is skipped. Both the GitHub and LinkedIn workers call this.
 */
export async function upsertGeneratedPost(
  db: Database,
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
