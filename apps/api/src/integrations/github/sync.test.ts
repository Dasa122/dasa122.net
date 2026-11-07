import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { eq } from "drizzle-orm";
import {
  postsTable,
  settingsTable,
  syncStateTable,
} from "../../database/schema";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import { startGitHubScheduler, syncGitHub } from "./sync";

type FetchImpl = typeof fetch;

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

const pushEvent = {
  actor: { login: "Dasa122" },
  created_at: "2026-11-06T12:00:00Z",
  id: "2001",
  payload: {
    commits: [{ message: "Ship it", sha: "aaa" }],
    ref: "refs/heads/main",
  },
  repo: { name: "Dasa122/dasa122.net" },
  type: "PushEvent",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

/** The R5 stub: events for the events URL, an empty list for the repos URL. */
const stubFetch = (events: unknown[], repos: unknown[] = []): FetchImpl =>
  (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/events/public")) {
      return jsonResponse(events);
    }
    if (url.includes("/repos")) {
      return jsonResponse(repos);
    }
    return jsonResponse([]);
  }) as unknown as FetchImpl;

const failingFetch = (async () => {
  throw new Error("network down");
}) as unknown as FetchImpl;

function push(id: string, size: number, createdAt: string) {
  return {
    ...pushEvent,
    created_at: createdAt,
    id,
    payload: {
      commits: [{ message: `Work ${id}`, sha: id }],
      ref: "refs/heads/main",
      size,
    },
  };
}

async function readSetting(key: string): Promise<unknown> {
  const [row] = await testDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return row?.value;
}

describe("syncGitHub", () => {
  test("creates one published post for a push event", async () => {
    const result = await syncGitHub({
      fetchImpl: stubFetch([pushEvent]),
      username: "Dasa122",
    });

    expect(result).toEqual({
      created: 1,
      error: null,
      skipped: 0,
      updated: 0,
    });
    const rows = await testDb.select().from(postsTable);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("published");
    expect(rows[0]?.slug).toBe("ship-it");
    expect(rows[0]?.source).toBe("github");
    expect(rows[0]?.externalId).toBe("Dasa122/dasa122.net:2001");
    expect(rows[0]?.externalUrl).toBe("https://github.com/Dasa122/dasa122.net");
    expect(rows[0]?.excerpt).toBe("Ship it");
    expect(rows[0]?.readTimeMin).toBe(1);

    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.source).toBe("github");
    expect(state?.lastStatus).toBe("ok");
    expect(state?.lastError).toBeNull();
    expect(state?.lastRunAt).toBeInstanceOf(Date);
  });

  test("running twice does not duplicate the post", async () => {
    await syncGitHub({
      fetchImpl: stubFetch([pushEvent]),
      username: "Dasa122",
    });
    const second = await syncGitHub({
      fetchImpl: stubFetch([pushEvent]),
      username: "Dasa122",
    });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(second.error).toBeNull();
    const rows = await testDb.select().from(postsTable);
    expect(rows).toHaveLength(1);
  });

  test("a push with two commits produces one post titled with the latest subject", async () => {
    const event = {
      ...pushEvent,
      payload: {
        commits: [
          { message: "first commit", sha: "aaa" },
          { message: "Ship the news feed\n\nlong body", sha: "bbb" },
        ],
        ref: "refs/heads/main",
      },
    };
    const result = await syncGitHub({
      fetchImpl: stubFetch([event]),
      username: "Dasa122",
    });

    expect(result.created).toBe(1);
    const rows = await testDb.select().from(postsTable);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Ship the news feed");
    expect(rows[0]?.githubMeta?.commitSha).toBe("bbb");
  });

  test("writes the repository snapshot and language counts to the settings table", async () => {
    const repos = [
      {
        description: "Personal site",
        fork: false,
        forks_count: 1,
        html_url: "https://github.com/Dasa122/dasa122.net",
        language: "TypeScript",
        name: "Dasa122/dasa122.net",
        stargazers_count: 3,
        updated_at: "2026-11-06T00:00:00.000Z",
      },
      {
        description: "An old fork",
        fork: true,
        forks_count: 0,
        html_url: "https://github.com/Dasa122/old",
        language: "TypeScript",
        name: "Dasa122/old",
        stargazers_count: 0,
        updated_at: "2026-11-01T00:00:00.000Z",
      },
    ];
    const result = await syncGitHub({
      fetchImpl: stubFetch(
        [
          push("3001", 3, "2026-11-06T12:00:00Z"),
          push("3002", 2, "2026-11-05T09:00:00Z"),
        ],
        repos,
      ),
      username: "Dasa122",
    });

    expect(result.error).toBeNull();
    const snapshot = (await readSetting("github:overview")) as {
      activity: Array<{ count: number; date: string }>;
      languages: Record<string, number>;
      repos: Array<{ name: string }>;
      syncedAt: string;
      totalCommits: number;
    };
    expect(snapshot.repos.map((repo) => repo.name)).toEqual([
      "Dasa122/dasa122.net",
    ]);
    expect(snapshot.languages).toEqual({ TypeScript: 1 });
    expect(snapshot.totalCommits).toBe(5);
    expect(snapshot.activity).toEqual([
      { count: 2, date: "2026-11-05" },
      { count: 3, date: "2026-11-06" },
    ]);
    expect(typeof snapshot.syncedAt).toBe("string");
  });

  test("a malformed repositories payload is filtered, never thrown", async () => {
    const result = await syncGitHub({
      // The repos URL answers with the events payload, which has no `name`.
      fetchImpl: stubFetch([pushEvent], [pushEvent]),
      username: "Dasa122",
    });

    expect(result.error).toBeNull();
    const snapshot = (await readSetting("github:overview")) as {
      repos: unknown[];
    };
    expect(snapshot.repos).toEqual([]);
  });

  test("a post whose title has no alphanumerics is skipped", async () => {
    const event = {
      ...pushEvent,
      payload: {
        commits: [{ message: "!!!", sha: "aaa" }],
        ref: "refs/heads/main",
      },
    };
    const result = await syncGitHub({
      fetchImpl: stubFetch([event]),
      username: "Dasa122",
    });

    expect(result).toEqual({
      created: 0,
      error: null,
      skipped: 1,
      updated: 0,
    });
    const rows = await testDb.select().from(postsTable);
    expect(rows).toHaveLength(0);
  });

  test("a failed sync keeps the last good snapshot and records the error", async () => {
    await syncGitHub({
      fetchImpl: stubFetch(
        [pushEvent],
        [
          {
            description: "Personal site",
            fork: false,
            forks_count: 1,
            html_url: "https://github.com/Dasa122/dasa122.net",
            language: "TypeScript",
            name: "Dasa122/dasa122.net",
            stargazers_count: 3,
            updated_at: "2026-11-06T00:00:00.000Z",
          },
        ],
      ),
      username: "Dasa122",
    });
    const snapshot = await readSetting("github:overview");

    const failed = await syncGitHub({
      fetchImpl: failingFetch,
      username: "Dasa122",
    });

    expect(failed.error).not.toBeNull();
    expect(failed.created).toBe(0);
    expect(await readSetting("github:overview")).toEqual(snapshot);

    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.lastStatus).toBe("error");
    expect(state?.lastError).toContain("network down");

    const rows = await testDb.select().from(postsTable);
    expect(rows).toHaveLength(1);
  });

  test("a non-2xx response is reported as an error", async () => {
    const result = await syncGitHub({
      fetchImpl: (async () =>
        jsonResponse({ message: "boom" }, 500)) as unknown as FetchImpl,
      username: "Dasa122",
    });

    expect(result).toEqual({
      created: 0,
      error: "Error: github_api_error",
      skipped: 0,
      updated: 0,
    });
    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.lastStatus).toBe("error");
    expect(state?.lastError).toBe("Error: github_api_error");
  });

  test("the scheduler does not schedule under NODE_ENV=test", () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return jsonResponse([]);
    }) as unknown as FetchImpl;

    try {
      startGitHubScheduler(1);
    } finally {
      globalThis.fetch = original;
    }

    expect(called).toBe(false);
  });
});
