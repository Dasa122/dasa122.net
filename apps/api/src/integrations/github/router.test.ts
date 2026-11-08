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
import {
  experimental_ZodSmartCoercionPlugin,
  ZodToJsonSchemaConverter,
} from "@orpc/zod/zod4";
import { eq } from "drizzle-orm";
import type { SessionRecord } from "../../auth/session";
import { settingsTable } from "../../database/schema";
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

const adminSession: SessionRecord = {
  email: null,
  expiresAt: new Date(Date.now() + 3_600_000),
  groups: ["dasa122.net-admin"],
  id: "test-admin",
  name: null,
  subject: "test-admin",
};

const REPO = {
  description: "Personal site",
  forks: 1,
  language: "TypeScript",
  name: "Dasa122/dasa122.net",
  stars: 3,
  updatedAt: "2026-11-06T00:00:00.000Z",
  url: "https://github.com/Dasa122/dasa122.net",
};

const SNAPSHOT = {
  activity: [{ count: 2, date: "2026-11-06" }],
  languages: { TypeScript: 1 },
  pulls: [
    {
      bodyHtml: "<p>Fixes the thing.</p>",
      createdAt: "2026-11-05T10:00:00.000Z",
      merged: true,
      number: 12,
      repo: "Dasa122/dasa122.net",
      state: "closed",
      title: "Fix the thing",
      updatedAt: "2026-11-06T10:00:00.000Z",
      url: "https://github.com/Dasa122/dasa122.net/pull/12",
    },
  ],
  repos: [REPO],
  syncedAt: "2026-11-06T12:00:00.000Z",
};

const EMPTY_OVERVIEW = {
  activity: [],
  languages: {},
  lastSyncedAt: null,
  pulls: [],
  repos: [],
};

beforeAll(async () => {
  await migrateTestDb(testDb);
});
afterAll(async () => {
  await testDb.$client.end();
});
beforeEach(async () => {
  await resetTables(testDb);
});

async function call(
  path: string,
  init: RequestInit = {},
  session: SessionRecord | null = null,
) {
  const request = new Request(`http://localhost${path}`, init);
  return openApiHandler.handle(request, {
    context: { db: testDb, now: new Date(), request, session },
    prefix: "/api",
  });
}

async function readSetting(key: string): Promise<unknown> {
  const [row] = await testDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return row?.value;
}

async function overview() {
  const { response } = await call("/api/github/overview");
  return { body: await response?.json(), status: response?.status };
}

describe("github.overview", () => {
  test("returns the empty state before anything has synced", async () => {
    const { body, status } = await overview();
    expect(status).toBe(200);
    expect(body).toEqual(EMPTY_OVERVIEW);
  });

  test("a corrupt snapshot returns the empty state, not a 500", async () => {
    await testDb
      .insert(settingsTable)
      .values({ key: "github:overview", value: { nonsense: true } });

    const { body, status } = await overview();
    expect(status).toBe(200);
    expect(body).toEqual(EMPTY_OVERVIEW);
  });

  test("applies the featured set at read time without touching the snapshot", async () => {
    await testDb
      .insert(settingsTable)
      .values({ key: "github:overview", value: SNAPSHOT });

    const before = (await overview()).body as {
      repos: Array<{ featured: boolean }>;
    };
    expect(before.repos[0]?.featured).toBe(false);

    await testDb
      .insert(settingsTable)
      .values({ key: "github:featured", value: ["Dasa122/dasa122.net"] });
    const featured = (await overview()).body as {
      repos: Array<{ featured: boolean }>;
    };
    expect(featured.repos[0]?.featured).toBe(true);

    // Removing it from the featured set is visible immediately: no resync.
    await testDb
      .update(settingsTable)
      .set({ value: [] })
      .where(eq(settingsTable.key, "github:featured"));
    const unfeatured = (await overview()).body as {
      repos: Array<{ featured: boolean }>;
    };
    expect(unfeatured.repos[0]?.featured).toBe(false);
    expect(await readSetting("github:overview")).toEqual(SNAPSHOT);
  });

  test("serves the snapshot fields the contract describes", async () => {
    await testDb
      .insert(settingsTable)
      .values({ key: "github:overview", value: SNAPSHOT });

    const { body } = await overview();
    expect(body).toEqual({
      activity: SNAPSHOT.activity,
      languages: SNAPSHOT.languages,
      lastSyncedAt: SNAPSHOT.syncedAt,
      pulls: SNAPSHOT.pulls,
      repos: SNAPSHOT.repos.map((repo) => ({ ...repo, featured: false })),
    });
  });
});

describe("adminGithub", () => {
  test("the status endpoint is gated", async () => {
    const { response } = await call("/api/admin/github");
    expect(response?.status).toBe(401);
  });

  test("the status endpoint reads the cached snapshot without calling GitHub", async () => {
    await testDb
      .insert(settingsTable)
      .values({ key: "github:overview", value: SNAPSHOT });

    let fetchCalls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response("[]");
    }) as unknown as typeof fetch;

    try {
      const { response } = await call("/api/admin/github", {}, adminSession);
      expect(response?.status).toBe(200);
      const body = (await response?.json()) as {
        lastStatus: string | null;
        repos: Array<{ featured: boolean; name: string }>;
        tokenPresent: boolean;
        username: string;
      };
      expect(body.repos).toEqual([{ ...REPO, featured: false }]);
      expect(body.username).toBe("Dasa122");
      expect(body.tokenPresent).toBe(false);
      expect(body.lastStatus).toBeNull();
    } finally {
      globalThis.fetch = original;
    }

    expect(fetchCalls).toBe(0);
  });

  test("the sync endpoint is gated", async () => {
    const { response } = await call("/api/admin/github/sync", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(response?.status).toBe(401);
  });

  test("the sync endpoint runs a sync and returns its counts", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/events/public")
        ? [
            {
              actor: { login: "Dasa122" },
              created_at: "2026-11-06T12:00:00Z",
              id: "9001",
              payload: {
                commits: [{ message: "Sync endpoint", sha: "abc" }],
                ref: "refs/heads/main",
              },
              repo: { name: "Dasa122/dasa122.net" },
              type: "PushEvent",
            },
          ]
        : [];
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }) as unknown as typeof fetch;

    try {
      const { response } = await call(
        "/api/admin/github/sync",
        {
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
        adminSession,
      );

      expect(response?.status).toBe(200);
      expect(await response?.json()).toEqual({
        created: 1,
        error: null,
        skipped: 0,
        updated: 0,
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("the featured endpoint persists the full new list", async () => {
    const { response } = await call(
      "/api/admin/github/featured",
      {
        body: JSON.stringify({ repos: ["Dasa122/dasa122.net"] }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
      adminSession,
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      repos: ["Dasa122/dasa122.net"],
    });
    expect(await readSetting("github:featured")).toEqual([
      "Dasa122/dasa122.net",
    ]);
  });

  test("the featured endpoint is gated", async () => {
    const { response } = await call("/api/admin/github/featured", {
      body: JSON.stringify({ repos: [] }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(response?.status).toBe(401);
    expect(await readSetting("github:featured")).toBeUndefined();
  });
});
