import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { handleRequest, openApiHandler } from "../app";
import type { ApiContext } from "../middleware/context";
import { insertPostRepo } from "../modules/posts/repository";
import { createTestDb, migrateTestDb, resetTables } from "./helpers";

/**
 * The REST surface over real HTTP requests, driven without `Bun.serve` so this
 * suite never binds a port. The three GETs go through `openApiHandler.handle`
 * directly; the logout case goes through the full dispatch because the origin
 * guard lives in front of the auth branch.
 */

const testDb = createTestDb();

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

async function get(path: string): Promise<Response> {
  const request = new Request(`http://localhost${path}`);
  const { matched, response } = await openApiHandler.handle(request, {
    context: context(request),
    prefix: "/api",
  });
  expect(matched).toBe(true);
  if (response === undefined) {
    throw new Error("expected a matched response");
  }
  return response;
}

describe("the REST surface over HTTP", () => {
  test("GET /api/posts?limit=1 coerces the query number", async () => {
    const response = await get("/api/posts?limit=1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
  });

  test("GET /api/posts/<slug> extracts the path parameter", async () => {
    const post = await insertPostRepo(testDb, {
      publishedAt: new Date(),
      slug: "path-parameter",
      source: "own",
      status: "published",
      title: "Path parameter",
    });

    const response = await get("/api/posts/path-parameter");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; slug: string };
    expect(body.id).toBe(post.id);
    expect(body.slug).toBe("path-parameter");
  });

  test("GET /api/posts?sources[0]=own decodes the bracket array", async () => {
    const response = await get("/api/posts?sources[0]=own");

    expect(response.status).toBe(200);
  });

  test("POST /api/auth/logout from another origin is 403", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/auth/logout", {
        headers: { origin: "https://evil.example" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
  });
});
