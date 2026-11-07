import { handleRequest } from "./app";
import { db, migrateToLatest } from "./database/index";
import { env } from "./env";
import { startGitHubScheduler } from "./integrations/github/sync";
import { startLinkedInScheduler } from "./integrations/linkedin/sync";
import { logger } from "./logger";

export { openApiHandler, rpcHandler } from "./app";

try {
  await migrateToLatest(db);
} catch (error) {
  logger.error({ err: error }, "database migration failed");
  process.exit(1);
}
logger.info({ port: env.port }, "database migrations applied, starting api");

startGitHubScheduler(env.github.syncIntervalMinutes);
startLinkedInScheduler(env.linkedin.syncIntervalMinutes);

export const server = Bun.serve({
  fetch: handleRequest,
  port: env.port,
});
