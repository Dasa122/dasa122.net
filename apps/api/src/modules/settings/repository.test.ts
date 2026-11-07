import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { siteSettingsSchema } from "@dasa122/contract";
import { settingsTable } from "../../database/schema";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import {
  DEFAULT_SITE_SETTINGS,
  getSettings,
  updateSettings,
} from "./repository";

const testDb = createTestDb();

beforeAll(async () => {
  await migrateTestDb(testDb);
});
afterAll(async () => {
  await testDb.$client.end();
});
beforeEach(async () => {
  await resetTables(testDb);
});

describe("settings", () => {
  test("returns the defaults when no row exists", async () => {
    const settings = await getSettings();
    expect(settings.name).toBe(DEFAULT_SITE_SETTINGS.name);
    expect(settings.enabledSources).toEqual(["own", "github", "linkedin"]);
  });

  test("persists an update and reads it back", async () => {
    await updateSettings({ tagline: "Building things" });
    const settings = await getSettings();
    expect(settings.tagline).toBe("Building things");
  });

  test("a partial stored object keeps every default field", async () => {
    await testDb
      .insert(settingsTable)
      .values({ key: "site", value: { tagline: "Stored only" } });

    const settings = await getSettings();
    expect(settings.tagline).toBe("Stored only");
    expect(settings.name).toBe("Dasa122");
    expect(settings.githubUsername).toBe("Dasa122");
    expect(settings.socials).toEqual({});
  });

  test("merges a socials patch one level deep", async () => {
    await updateSettings({ socials: { email: "a@b.c", github: "dasa" } });
    const settings = await updateSettings({ socials: { linkedin: "li" } });

    expect(settings.socials).toEqual({
      email: "a@b.c",
      github: "dasa",
      linkedin: "li",
    });
  });

  test("a partial patch leaves every other field at its previous value", async () => {
    await updateSettings({
      description: "keep me",
      name: "Custom",
      tagline: "before",
    });
    const settings = await updateSettings({ tagline: "x" });

    expect(settings.name).toBe("Custom");
    expect(settings.description).toBe("keep me");
    expect(settings.tagline).toBe("x");
    expect(siteSettingsSchema.safeParse(settings).success).toBe(true);
  });

  test("a socials patch keeps links the caller did not mention", async () => {
    await updateSettings({
      socials: { linkedin: "https://linkedin.com/in/x" },
    });
    const settings = await updateSettings({
      socials: { github: "https://github.com/x" },
    });

    expect(settings.socials.github).toBe("https://github.com/x");
    expect(settings.socials.linkedin).toBe("https://linkedin.com/in/x");
  });

  test("an explicitly undefined key does not clear a stored field", async () => {
    await updateSettings({ tagline: "before" });
    const settings = await updateSettings({ tagline: undefined } as never);

    expect(settings.tagline).toBe("before");
  });

  test("an invalid stored blob falls back to the defaults", async () => {
    await testDb
      .insert(settingsTable)
      .values({ key: "site", value: { socials: null } });

    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SITE_SETTINGS);
  });
});
