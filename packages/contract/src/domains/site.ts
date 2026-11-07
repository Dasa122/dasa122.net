import z from "zod";
import { postSourceSchema } from "./posts";

/** The site's global settings, stored as one JSON blob under the `site` key. */
export const siteSettingsSchema = z.object({
  accent: z.string().nullable(),
  description: z.string(),
  enabledSources: z.array(postSourceSchema),
  githubUsername: z.string().nullable(),
  name: z.string(),
  ogImage: z.string().nullable(),
  socials: z.object({
    email: z.string().optional(),
    github: z.string().optional(),
    linkedin: z.string().optional(),
    rss: z.string().optional(),
  }),
  tagline: z.string(),
});

/** A partial update: every field is optional. */
export const settingsUpdateSchema = siteSettingsSchema.partial();
