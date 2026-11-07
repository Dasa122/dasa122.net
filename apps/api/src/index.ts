import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  experimental_ZodSmartCoercionPlugin,
  ZodToJsonSchemaConverter,
} from "@orpc/zod/zod4";
import { desc, eq } from "drizzle-orm";
import { handleAuthRoutes } from "./auth/routes";
import { db, migrateToLatest } from "./database/index";
import { mediaTable } from "./database/schema";
import { env } from "./env";
import { logger } from "./logger";
import { requireAdmin } from "./middleware/auth";
import { type ApiContext, buildContext } from "./middleware/context";
import { assertSameOrigin } from "./middleware/csrf";
import { parseMediaFilename } from "./modules/media/filename";
import { mediaFilePath } from "./modules/media/repository";
import { readMediaUpload } from "./modules/media/router";
import { appRouter } from "./router";

export const rpcHandler = new RPCHandler<ApiContext>(appRouter);
export const openApiHandler = new OpenAPIHandler<ApiContext>(appRouter, {
  plugins: [
    new experimental_ZodSmartCoercionPlugin(),
    new OpenAPIReferencePlugin({
      docsPath: "/doc/swagger",
      docsProvider: "swagger",
      schemaConverters: [new ZodToJsonSchemaConverter()],
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

const MEDIA_PREFIX = "/api/media/";

function badMediaRequest(): Response {
  return json(400, {
    error: "bad_request",
    message: "Invalid media filename",
  });
}

/**
 * Serves an uploaded file from `MEDIA_DIR`. The filename is rejected outright
 * when it can leave that directory, so no encoding can escape it.
 */
async function serveMedia(pathname: string): Promise<Response> {
  const filename = parseMediaFilename(pathname.slice(MEDIA_PREFIX.length));
  if (filename === null) {
    return badMediaRequest();
  }

  const file = Bun.file(mediaFilePath(filename));
  if (!(await file.exists())) {
    return json(404, { error: "not_found", message: "Media not found" });
  }

  const [row] = await db
    .select({ mime: mediaTable.mime })
    .from(mediaTable)
    .where(eq(mediaTable.filename, filename))
    .orderBy(desc(mediaTable.createdAt))
    .limit(1);

  return new Response(file, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": row?.mime ?? "application/octet-stream",
    },
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

      if (url.pathname.startsWith(MEDIA_PREFIX)) {
        return await serveMedia(url.pathname);
      }

      const context = await buildContext(request);

      // The contract's upload input describes the stored metadata and cannot
      // carry file bytes, so the multipart upload is dispatched here before
      // oRPC's JSON input validation would reject it.
      if (request.method === "POST" && url.pathname === "/api/admin/media") {
        await requireAdmin(context);
        return json(200, await readMediaUpload(request));
      }

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
