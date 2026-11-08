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
import { env } from "../../env";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import { pushSize, startGitHubScheduler, syncGitHub } from "./sync";

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

/** The R5 stub: events for the events URL, empty lists elsewhere. */
const stubFetch = (
  events: unknown[],
  repos: unknown[] = [],
  pulls: unknown[] = [],
): FetchImpl =>
  (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/events/public")) {
      return jsonResponse(events);
    }
    if (url.includes("/search/issues")) {
      return jsonResponse({ items: pulls });
    }
    if (url.includes("/repos")) {
      return jsonResponse(repos);
    }
    return jsonResponse([]);
  }) as unknown as FetchImpl;

const failingFetch = (async () => {
  throw new Error("network down");
}) as unknown as FetchImpl;

/** A stub that records which endpoint a scheduler-triggered sync hits. */
function recordingFetch(events: unknown[] = []) {
  const calls = { events: 0, repos: 0 };
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/events/public")) {
      calls.events += 1;
      return jsonResponse(events);
    }
    if (url.includes("/repos")) {
      calls.repos += 1;
      return jsonResponse([]);
    }
    return jsonResponse([]);
  }) as unknown as FetchImpl;
  return { calls, impl };
}

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

/** A search-result item, shaped the way `GET /search/issues` returns one. */
function pullItem(number: number, updatedAt: string) {
  return {
    body: "Fixes all the things.",
    created_at: "2026-11-05T09:00:00Z",
    html_url: `https://github.com/Dasa122/dasa122.net/pull/${number}`,
    number,
    pull_request: { merged_at: "2026-11-06T09:00:00Z" },
    repository_url: "https://api.github.com/repos/Dasa122/dasa122.net",
    state: "closed",
    title: `Pull ${number}`,
    updated_at: updatedAt,
  };
}

describe("pushSize", () => {
  test("the real payload shape, with no size or commits, counts as one push", () => {
    const event = {
      ...pushEvent,
      payload: {
        before: "0000000",
        head: "1111111",
        push_id: 6789,
        ref: "refs/heads/main",
        repository_id: 12_345,
      },
    };

    expect(pushSize(event)).toBe(1);
  });

  test("distinct_size wins over the one-push floor", () => {
    const event = {
      ...pushEvent,
      payload: {
        distinct_size: 4,
        ref: "refs/heads/main",
      },
    };

    expect(pushSize(event)).toBe(4);
  });
});

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
      pulls: unknown[];
      repos: Array<{ name: string }>;
      syncedAt: string;
    };
    expect(snapshot.repos.map((repo) => repo.name)).toEqual([
      "Dasa122/dasa122.net",
    ]);
    expect(snapshot.languages).toEqual({ TypeScript: 1 });
    expect(snapshot.pulls).toEqual([]);
    expect(snapshot.activity).toEqual([
      { count: 2, date: "2026-11-05" },
      { count: 3, date: "2026-11-06" },
    ]);
    expect(typeof snapshot.syncedAt).toBe("string");
  });

  test("caches at most 30 pulls, newest update first", async () => {
    const items = Array.from({ length: 35 }, (_, index) =>
      pullItem(
        index + 1,
        `2026-11-${String((index % 28) + 1).padStart(2, "0")}T09:00:00Z`,
      ),
    );
    const result = await syncGitHub({
      fetchImpl: stubFetch([pushEvent], [], items),
      username: "Dasa122",
    });

    expect(result.error).toBeNull();
    const snapshot = (await readSetting("github:overview")) as {
      pulls: Array<{
        bodyHtml: string | null;
        number: number;
        repo: string;
        state: string;
        updatedAt: string;
      }>;
    };
    expect(snapshot.pulls).toHaveLength(30);
    expect(snapshot.pulls[0]?.updatedAt).toBe("2026-11-28T09:00:00.000Z");
    expect(snapshot.pulls[0]?.bodyHtml).toContain("Fixes all the things.");
    expect(snapshot.pulls[0]?.repo).toBe("Dasa122/dasa122.net");
  });

  test("a failed pulls fetch keeps the previous pulls and does not fail the run", async () => {
    await syncGitHub({
      fetchImpl: stubFetch(
        [pushEvent],
        [],
        [pullItem(7, "2026-11-06T09:00:00Z")],
      ),
      username: "Dasa122",
    });

    const failingPulls = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search/issues")) {
        throw new Error("search down");
      }
      if (url.includes("/events/public")) {
        return jsonResponse([pushEvent]);
      }
      return jsonResponse([]);
    }) as unknown as FetchImpl;

    const result = await syncGitHub({
      fetchImpl: failingPulls,
      username: "Dasa122",
    });

    expect(result.error).toBeNull();
    const snapshot = (await readSetting("github:overview")) as {
      pulls: Array<{ number: number }>;
    };
    expect(snapshot.pulls.map((pull) => pull.number)).toEqual([7]);
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

  test("a timed-out request surfaces as the generic github_api_error", async () => {
    let sawSignal = false;
    const timeoutFetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      sawSignal = init?.signal instanceof AbortSignal;
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as unknown as FetchImpl;

    const result = await syncGitHub({
      fetchImpl: timeoutFetch,
      username: "Dasa122",
    });

    expect(sawSignal).toBe(true);
    expect(result.error).toBe("Error: github_api_error");
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

  test("the boot sync runs only when the last run is older than the interval", async () => {
    const originalNodeEnv = env.nodeEnv;
    const originalFetch = globalThis.fetch;
    env.nodeEnv = "development";

    try {
      // A run inside the interval is skipped, so a restart cannot spend budget.
      await testDb.insert(syncStateTable).values({
        lastRunAt: new Date(),
        lastStatus: "ok",
        source: "github",
      });
      const recent = recordingFetch();
      globalThis.fetch = recent.impl;

      startGitHubScheduler(60);
      await Bun.sleep(250);

      expect(recent.calls.events).toBe(0);

      // Two intervals later the same boot recovers once.
      await resetTables(testDb);
      await testDb.insert(syncStateTable).values({
        lastRunAt: new Date(Date.now() - 2 * 60 * 60_000),
        lastStatus: "ok",
        source: "github",
      });
      const stale = recordingFetch();
      globalThis.fetch = stale.impl;

      startGitHubScheduler(60);
      for (
        let attempt = 0;
        attempt < 100 && stale.calls.events === 0;
        attempt++
      ) {
        await Bun.sleep(20);
      }

      expect(stale.calls.events).toBe(1);

      // Let the fire-and-forget sync finish before the file tears down.
      for (let attempt = 0; attempt < 100; attempt++) {
        const [state] = await testDb.select().from(syncStateTable);
        if (state?.lastStatus === "ok") {
          break;
        }
        await Bun.sleep(20);
      }
    } finally {
      globalThis.fetch = originalFetch;
      env.nodeEnv = originalNodeEnv;
    }
  });
});
