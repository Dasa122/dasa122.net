import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { postsTable } from "../database/schema";
import { createTestDb, migrateTestDb, resetTables } from "./helpers";

const db = createTestDb();

beforeAll(async () => {
  await migrateTestDb(db);
});
afterAll(async () => {
  await db.$client.end();
});
beforeEach(async () => {
  await resetTables(db);
});

describe("posts table", () => {
  test("rejects two rows with the same (source, externalId)", async () => {
    const base = {
      externalId: "dasa122.net:12345",
      source: "github",
      title: "Pushed to dasa122.net",
    };
    await db.insert(postsTable).values(base);
    // Drizzle returns a thenable, not a native Promise; wrap it so Bun's
    // `.rejects` can await it.
    await expect(
      Promise.resolve(db.insert(postsTable).values(base)),
    ).rejects.toThrow();
  });
});
