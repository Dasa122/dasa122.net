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

/** A copy of `object` without the keys whose value is `undefined`. */
function stripUndefined<T extends object>(object: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Merges the patch over the current settings and upserts the `site` row.
 *
 * oRPC parses an omitted optional key as an explicit `undefined`, so only keys
 * the caller actually supplied may overwrite anything. `socials` is merged one
 * level deep and its `undefined` children are ignored too. The result goes
 * through the same schema as `getSettings`, so both read paths agree.
 */
export async function updateSettings(
  patch: Partial<SiteSettings>,
): Promise<SiteSettings> {
  const current = await getSettings();
  const { socials: socialsPatch, ...rest } = stripUndefined(patch);
  const socials =
    typeof socialsPatch === "object" && socialsPatch !== null
      ? { ...current.socials, ...stripUndefined(socialsPatch) }
      : current.socials;

  const parsed = siteSettingsSchema.safeParse({
    ...current,
    ...rest,
    socials,
  });
  const next = parsed.success ? parsed.data : { ...DEFAULT_SITE_SETTINGS };

  await db
    .insert(settingsTable)
    .values({ key: SITE_KEY, value: next })
    .onConflictDoUpdate({
      set: { value: next },
      target: settingsTable.key,
    });
  return next;
}
