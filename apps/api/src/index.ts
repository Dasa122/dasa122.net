import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { handleAuthRoutes } from "./auth/routes";
import { db, migrateToLatest } from "./database/index";
import { env } from "./env";
import { logger } from "./logger";
import { type ApiContext, buildContext } from "./middleware/context";
import { assertSameOrigin } from "./middleware/csrf";
import { appRouter } from "./router";

export const rpcHandler = new RPCHandler<ApiContext>(appRouter);
export const openApiHandler = new OpenAPIHandler<ApiContext>(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/doc/swagger",
      docsProvider: "swagger",
      specPath: "/doc/openapi.json",
    }),
  ],
});

try {
  await migrateToLatest(db);
} catch (error) {
  logger.error({ err: error }, "database migration failed");
  process.exit(1);
}
logger.info({ port: env.port }, "database migrations applied, starting api");

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

export const server = Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);
    try {
      assertSameOrigin(request, env.publicOrigin);

      if (url.pathname.startsWith("/api/auth/")) {
        return await handleAuthRoutes(request, url);
      }

      const context = await buildContext(request);

      if (url.pathname === "/api/rpc" || url.pathname.startsWith("/api/rpc/")) {
        const { matched, response } = await rpcHandler.handle(request, {
          context,
          prefix: "/api/rpc",
        });
        if (matched) return response;
      }

      const { matched, response } = await openApiHandler.handle(request, {
        context,
        prefix: "/api",
      });
      if (matched) return response;

      return json(404, { error: "not_found", message: "Not found" });
    } catch (error) {
      if (error instanceof ORPCError) {
        logger.warn(
          { code: error.code, status: error.status },
          "request rejected",
        );
        return json(error.status, {
          error: error.code,
          message: error.message,
        });
      }
      logger.error({ err: error }, "request failed");
      return json(500, {
        error: "internal_error",
        message: "Internal Server Error",
      });
    }
  },
  port: env.port,
});
