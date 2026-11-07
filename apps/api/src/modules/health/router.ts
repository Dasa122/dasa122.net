import { base } from "../../orpc";

export const health = base.health.check.handler(async ({ context }) => {
  let database: "up" | "down" = "down";
  try {
    await context.db.execute("SELECT 1");
    database = "up";
  } catch {
    database = "down";
  }
  return {
    database,
    status: database === "up" ? ("ok" as const) : ("degraded" as const),
    version: process.env.npm_package_version ?? "0.0.0",
  };
});
