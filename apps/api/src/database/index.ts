import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { env } from "../env";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string): Database {
  const client = new SQL({ adapter: "postgres", prepare: false, url });
  return drizzle(client, { schema });
}

/**
 * Where the committed SQL lives. Relative paths resolve against the process
 * working directory, so the image sets this explicitly rather than relying on
 * a platform's cwd.
 */
const migrationsFolder =
  process.env.MIGRATIONS_FOLDER ?? "src/database/migrations";

export async function migrateToLatest(db: Database): Promise<void> {
  // The migrator reads `meta/_journal.json` first. Checking it here turns a
  // wrong working directory into a boot failure that names the path, instead
  // of a healthy-looking container that never applied a migration.
  const journal = `${migrationsFolder}/meta/_journal.json`;
  if (!(await Bun.file(journal).exists())) {
    throw new Error(
      `migrations folder not found: ${migrationsFolder} (expected ${journal}, cwd ${process.cwd()})`,
    );
  }
  await migrate(db, { migrationsFolder });
}

export const db = createDb(env.databaseUrl);
