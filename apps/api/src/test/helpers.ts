import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "../database/schema";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/dasa122_net_test";

export function createTestDb() {
  const client = new SQL({
    adapter: "postgres",
    prepare: false,
    url: TEST_DATABASE_URL,
  });
  return drizzle(client, { schema });
}

export async function migrateTestDb(db: ReturnType<typeof createTestDb>) {
  await migrate(db, { migrationsFolder: "src/database/migrations" });
}

export async function resetTables(db: ReturnType<typeof createTestDb>) {
  await db.execute(
    sql`TRUNCATE TABLE posts, projects, sessions, settings, sync_state, media RESTART IDENTITY CASCADE`,
  );
}
