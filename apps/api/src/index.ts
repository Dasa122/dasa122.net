import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { handleAuthRoutes } from "./auth/routes";
import { db, migrateToLatest } from "./database/index";
import { env } from "./env";
import { logger } from "./logger";
import { type ApiContext, buildContext } from "./middleware/context";
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

await migrateToLatest(db);
logger.info({ port: env.port }, "database migrations applied, starting api");

export const server = Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);
    try {
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

      return new Response("Not found", { status: 404 });
    } catch (error) {
      logger.error({ err: error }, "request failed");
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  port: env.port,
});
