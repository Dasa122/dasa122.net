import type {
  projectCreateSchema,
  projectSchema,
  projectUpdateSchema,
} from "@dasa122/contract";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../database";
import { projectsTable } from "../../database/schema";
import { renderMarkdown } from "../../util/markdown";
import { slugify, uniqueSlug } from "../../util/slug";

export type Project = z.infer<typeof projectSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

type ProjectRow = typeof projectsTable.$inferSelect;
type ProjectInsert = typeof projectsTable.$inferInsert;
type ProjectPatch = Partial<Omit<ProjectInsert, "createdAt" | "id">>;

/**
 * Maps a stored row to the contract shape: dates become ISO strings. Only the
 * detail read renders `bodyHtml`; lists carry the raw markdown as `body` and
 * leave the rendered HTML null, the way posts do.
 */
function toProject(row: ProjectRow, bodyHtml: string | null = null): Project {
  return {
    body: row.body,
    bodyHtml,
    coverImage: row.coverImage,
    createdAt: row.createdAt.toISOString(),
    featured: row.featured,
    id: row.id,
    liveUrl: row.liveUrl,
    repoUrl: row.repoUrl,
    slug: row.slug,
    sortOrder: row.sortOrder,
    stack: row.stack,
    status: row.status as Project["status"],
    summary: row.summary,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound() {
  return new ORPCError("NOT_FOUND", { message: "Project not found" });
}

async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const conditions = [eq(projectsTable.slug, slug)];
  if (excludeId !== undefined) {
    conditions.push(ne(projectsTable.id, excludeId));
  }
  const [row] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(...conditions))
    .limit(1);
  return row !== undefined;
}

/** The public work index: published only, display order first. */
export async function listPublishedProjects(): Promise<Project[]> {
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.status, "published"))
    .orderBy(asc(projectsTable.sortOrder), desc(projectsTable.createdAt));
  return rows.map((row) => toProject(row));
}

/** One published project by slug; drafts are invisible. `bodyHtml` is rendered
 * here and only here, from the stored markdown. */
export async function getPublishedProjectBySlug(
  slug: string,
): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.status, "published"), eq(projectsTable.slug, slug)),
    )
    .limit(1);
  if (row === undefined) {
    return null;
  }
  const body = row.body;
  const bodyHtml =
    body === null || body.trim() === "" ? null : await renderMarkdown(body);
  return toProject(row, bodyHtml);
}

/** The admin list: drafts included, optionally filtered by status. */
export async function adminListProjects(filter: {
  status?: "draft" | "published";
}): Promise<Project[]> {
  const rows = await db
    .select()
    .from(projectsTable)
    .where(
      filter.status === undefined
        ? undefined
        : eq(projectsTable.status, filter.status),
    )
    .orderBy(asc(projectsTable.sortOrder), desc(projectsTable.createdAt));
  return rows.map((row) => toProject(row));
}

/**
 * Creates a project with a slug derived from its title.
 *
 * Projects are published on creation: this is a personal showcase site, not a
 * CMS with an editorial workflow, so a project added through the admin panel
 * is meant to be visible. The `status` column and the public query's filter
 * stay in place, so a draft workflow can be added later without a migration.
 */
export async function adminCreateProject(
  input: ProjectCreateInput,
): Promise<Project> {
  const slug = await uniqueSlug(
    slugify(input.title) || "project",
    (candidate) => slugExists(candidate),
  );
  const [row] = await db
    .insert(projectsTable)
    .values({
      body: input.body,
      coverImage: input.coverImage,
      featured: input.featured,
      liveUrl: input.liveUrl,
      repoUrl: input.repoUrl,
      slug,
      sortOrder: input.sortOrder,
      stack: input.stack,
      status: "published",
      summary: input.summary,
      title: input.title,
    })
    .returning();
  if (row === undefined) {
    throw new Error("project_insert_failed");
  }
  return toProject(row);
}

/** Applies only the provided fields; the slug never changes. */
export async function adminUpdateProject(
  id: string,
  input: ProjectUpdateInput,
): Promise<Project> {
  const patch: ProjectPatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.body !== undefined) patch.body = input.body;
  if (input.stack !== undefined) patch.stack = input.stack;
  if (input.repoUrl !== undefined) patch.repoUrl = input.repoUrl;
  if (input.liveUrl !== undefined) patch.liveUrl = input.liveUrl;
  if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
  if (input.featured !== undefined) patch.featured = input.featured;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  const [row] = await db
    .update(projectsTable)
    .set(patch)
    .where(eq(projectsTable.id, id))
    .returning();
  if (row === undefined) {
    throw notFound();
  }
  return toProject(row);
}

export async function adminDeleteProject(id: string): Promise<void> {
  const rows = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, id))
    .returning({ id: projectsTable.id });
  if (rows.length === 0) {
    throw notFound();
  }
}
