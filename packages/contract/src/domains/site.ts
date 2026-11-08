import z from "zod";
import { postSourceSchema } from "./posts";
import { withoutDefaults } from "./strip-defaults";

/** The colour presets the site can be rendered in. */
export const paletteSchema = z.enum([
  "ember",
  "amber",
  "forest",
  "slate",
  "sand",
]);

/** The site's global settings, stored as one JSON blob under the `site` key. */
export const siteSettingsSchema = z.object({
  accent: z.string().nullable(),
  description: z.string(),
  enabledSources: z.array(postSourceSchema),
  githubUsername: z.string().nullable(),
  name: z.string(),
  ogImage: z.string().nullable(),
  palette: paletteSchema.default("ember"),
  socials: z.object({
    email: z.string().optional(),
    github: z.string().optional(),
    linkedin: z.string().optional(),
    rss: z.string().optional(),
  }),
  tagline: z.string(),
});

/** A partial update: every field is optional, and omitted fields stay omitted
 * rather than falling back to a create-time default. */
export const settingsUpdateSchema = z
  .object(withoutDefaults(siteSettingsSchema.shape))
  .partial();
