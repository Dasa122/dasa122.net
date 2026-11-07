import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    ssl: false,
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/dasa122_net",
  },
  dialect: "postgresql",
  out: "./src/database/migrations",
  schema: ["./src/database/schema.ts"],
  strict: true,
  verbose: true,
});
