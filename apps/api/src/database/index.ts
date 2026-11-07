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

export async function migrateToLatest(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: "src/database/migrations" });
}

export const db = createDb(env.databaseUrl);
