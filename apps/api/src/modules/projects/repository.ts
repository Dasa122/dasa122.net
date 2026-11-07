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
import { slugify, uniqueSlug } from "../../util/slug";

export type Project = z.infer<typeof projectSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

type ProjectRow = typeof projectsTable.$inferSelect;
type ProjectInsert = typeof projectsTable.$inferInsert;
type ProjectPatch = Partial<Omit<ProjectInsert, "createdAt" | "id">>;

/** Maps a stored row to the contract shape: dates become ISO strings. */
function toProject(row: ProjectRow): Project {
  return {
    body: row.body,
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
  return rows.map(toProject);
}

/** One published project by slug; drafts are invisible. */
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
  return row === undefined ? null : toProject(row);
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
  return rows.map(toProject);
}

/** Creates a draft project with a slug derived from its title. */
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
