import { siteSettingsSchema } from "@dasa122/contract";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../database";
import { settingsTable } from "../../database/schema";

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/** The defaults the public site renders before anything is stored. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  accent: null,
  description: "",
  enabledSources: ["own", "github", "linkedin"],
  githubUsername: "Dasa122",
  name: "Dasa122",
  ogImage: null,
  socials: {},
  tagline: "",
};

/** The one settings row that holds the whole site configuration blob. */
const SITE_KEY = "site";

/**
 * Reads the stored `site` blob and merges it over the defaults, so a partial
 * or missing row never loses a field.
 */
export async function getSettings(): Promise<SiteSettings> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, SITE_KEY))
    .limit(1);

  if (
    row === undefined ||
    typeof row.value !== "object" ||
    row.value === null
  ) {
    return { ...DEFAULT_SITE_SETTINGS };
  }

  const merged = {
    ...DEFAULT_SITE_SETTINGS,
    ...(row.value as Partial<SiteSettings>),
  };
  const parsed = siteSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...DEFAULT_SITE_SETTINGS };
}

/** Merges the patch over the current settings and upserts the `site` row. */
export async function updateSettings(
  patch: Partial<SiteSettings>,
): Promise<SiteSettings> {
  const current = await getSettings();
  const next = {
    ...current,
    ...patch,
    socials: { ...current.socials, ...patch.socials },
  };
  await db
    .insert(settingsTable)
    .values({ key: SITE_KEY, value: next })
    .onConflictDoUpdate({
      set: { value: next },
      target: settingsTable.key,
    });
  return next;
}
