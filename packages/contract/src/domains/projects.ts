import z from "zod";
import { withoutDefaults } from "./strip-defaults";

/** A project as the work pages and the admin editor render it. */
export const projectSchema = z.object({
  body: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  coverImage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  featured: z.boolean(),
  id: z.uuid(),
  liveUrl: z.string().nullable(),
  repoUrl: z.string().nullable(),
  slug: z.string(),
  sortOrder: z.number().int(),
  stack: z.array(z.string()),
  status: z.enum(["draft", "published"]),
  summary: z.string(),
  title: z.string(),
  updatedAt: z.iso.datetime(),
});

/** A project as the admin editor submits it. */
export const projectCreateSchema = z.object({
  body: z.string().max(50_000).nullable().default(null),
  coverImage: z.string().max(500).nullable().default(null),
  featured: z.boolean().default(false),
  liveUrl: z.string().max(500).nullable().default(null),
  repoUrl: z.string().max(500).nullable().default(null),
  sortOrder: z.number().int().default(0),
  stack: z.array(z.string().max(48)).max(12).default([]),
  summary: z.string().min(1).max(400),
  title: z.string().min(1).max(200),
});

/** A patch to an existing project; `id` names the row and omitted fields stay
 * omitted instead of being reset to a default. */
export const projectUpdateSchema = z
  .object(withoutDefaults(projectCreateSchema.shape))
  .partial()
  .extend({ id: z.uuid() });

export const projectBySlugSchema = z.object({ slug: z.string().min(1) });
