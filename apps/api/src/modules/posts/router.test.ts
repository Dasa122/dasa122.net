import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import {
  experimental_ZodSmartCoercionPlugin,
  ZodToJsonSchemaConverter,
} from "@orpc/zod/zod4";
import type { ApiContext } from "../../middleware/context";
import { appRouter } from "../../router";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";

const testDb = createTestDb();

const openApiHandler = new OpenAPIHandler<ApiContext>(appRouter, {
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
const rpcHandler = new RPCHandler<ApiContext>(appRouter);

beforeAll(async () => {
  await migrateTestDb(testDb);
});
afterAll(async () => {
  await testDb.$client.end();
});
beforeEach(async () => {
  await resetTables(testDb);
});

function context(request: Request): ApiContext {
  return { db: testDb, now: new Date(), request, session: null };
}

async function get(path: string) {
  const request = new Request(`http://localhost${path}`);
  return openApiHandler.handle(request, {
    context: context(request),
    prefix: "/api",
  });
}

describe("posts router over HTTP", () => {
  test("GET /api/posts?limit=5 coerces the query number", async () => {
    const { matched, response } = await get("/api/posts?limit=5");
    expect(matched).toBe(true);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
  });

  test("GET /api/posts?limit=abc is a validation error", async () => {
    const { response } = await get("/api/posts?limit=abc");
    expect(response?.status).toBe(400);
  });

  test("GET /api/posts?year=2024 coerces the query number", async () => {
    const { response } = await get("/api/posts?year=2024");
    expect(response?.status).toBe(200);
  });

  test("GET /api/posts?sources[0]=own decodes the bracket array", async () => {
    const { response } = await get("/api/posts?sources[0]=own");
    expect(response?.status).toBe(200);
  });

  test("GET /api/doc/openapi.json renders with integer limit/year", async () => {
    const { response } = await get("/api/doc/openapi.json");
    expect(response?.status).toBe(200);
    const document = (await response?.json()) as {
      paths: Record<
        string,
        {
          get: {
            parameters: Array<{
              name: string;
              schema: Record<string, unknown>;
            }>;
          };
        }
      >;
    };
    const operation = document.paths["/posts"]?.get;
    const limit = operation?.parameters.find(
      (parameter) => parameter.name === "limit",
    );
    const year = operation?.parameters.find(
      (parameter) => parameter.name === "year",
    );
    expect(limit?.schema.type).toBe("integer");
    expect(limit?.schema.default).toBe(20);
    expect(year?.schema.type).toBe("integer");
  });

  test("the RPC path still accepts real JSON numbers", async () => {
    const request = new Request("http://localhost/api/rpc/posts/list", {
      body: JSON.stringify({ json: { limit: 5 } }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const { matched, response } = await rpcHandler.handle(request, {
      context: context(request),
      prefix: "/api/rpc",
    });
    expect(matched).toBe(true);
    expect(response?.status).toBe(200);
  });
});
