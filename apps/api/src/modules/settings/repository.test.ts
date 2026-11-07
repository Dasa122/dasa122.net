import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
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
});
