import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  postsTable,
  settingsTable,
  syncStateTable,
} from "../../database/schema";
import { env } from "../../env";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import { probeLinkedInTier } from "./client";
import {
  getLinkedInStatus,
  publishLinkedInPost,
  startLinkedInScheduler,
  syncLinkedIn,
} from "./sync";

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

const CONFIG = { accessToken: "tok", clientId: "id", clientSecret: "secret" };
const NO_CREDENTIALS = { accessToken: null, clientId: "", clientSecret: "" };
const NO_TOKEN = { accessToken: null, clientId: "id", clientSecret: "secret" };
const ZERO_RESULT = { created: 0, error: null, skipped: 0, updated: 0 };

const PENDING_MESSAGE =
  "The LinkedIn token has not been checked yet. Automatic sync activates on the next scheduled check.";
const CHECK_FAILED_MESSAGE =
  "The LinkedIn check failed. Automatic sync stays inactive; publishing from the admin panel still works.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

type PostsReply = { body?: unknown; status: number };

type StubOptions = {
  /** One reply, or one per successive `/rest/posts` call (the last repeats). */
  posts?: PostsReply | PostsReply[];
};

/**
 * Routes `/rest/posts`, the only endpoint the integration may call. Any other
 * URL throws, so an accidental `/v2/userinfo` tier probe fails loudly.
 */
function stubFetch(options: StubOptions = {}) {
  const calls = { posts: 0 };
  const replies: PostsReply[] =
    options.posts === undefined
      ? [{ body: { elements: [] }, status: 200 }]
      : Array.isArray(options.posts)
        ? options.posts
        : [options.posts];

  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes("/rest/posts")) {
      throw new Error(`unexpected request: ${url}`);
    }
    const index = Math.min(calls.posts, replies.length - 1);
    const reply = replies[index] ?? { body: {}, status: 200 };
    calls.posts += 1;
    return jsonResponse(reply.body ?? {}, reply.status);
  }) as unknown as FetchImpl;

  return { calls, impl };
}

const ELEMENT = {
  commentary: "First line\nSecond line of the post",
  id: "urn:li:share:1",
  publishedAt: "2026-11-01T10:00:00.000Z",
  url: "https://www.linkedin.com/posts/owner_1",
};

async function readTierCache(): Promise<unknown> {
  const [row] = await testDb
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "linkedin:tier"));
  return row?.value;
}

describe("probeLinkedInTier", () => {
  test("a 200 posts response is active", async () => {
    const { impl } = stubFetch({
      posts: { body: { elements: [ELEMENT] }, status: 200 },
    });

    expect(await probeLinkedInTier("tok", impl)).toEqual({
      error: null,
      scopes: ["r_member_social"],
      tier: "active",
    });
  });

  test("a 403 is insufficient_scope", async () => {
    const { impl } = stubFetch({ posts: { status: 403 } });

    expect(await probeLinkedInTier("tok", impl)).toEqual({
      error: null,
      scopes: [],
      tier: "insufficient_scope",
    });
  });

  test("another non-2xx is manual with the error retained", async () => {
    const { impl } = stubFetch({ posts: { status: 500 } });

    expect(await probeLinkedInTier("tok", impl)).toEqual({
      error: "linkedin_api_error",
      scopes: null,
      tier: "manual",
    });
  });

  test("a 200 with a malformed body is manual", async () => {
    const { impl } = stubFetch({
      posts: { body: { unexpected: true }, status: 200 },
    });

    expect(await probeLinkedInTier("tok", impl)).toEqual({
      error: "linkedin_api_error",
      scopes: null,
      tier: "manual",
    });
  });
});

describe("syncLinkedIn", () => {
  test("is unconfigured without credentials and makes no request", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await syncLinkedIn({ config: NO_CREDENTIALS, fetchImpl: impl }),
    ).toEqual(ZERO_RESULT);
    expect(calls.posts).toBe(0);
  });

  test("is manual without a token and makes no request", async () => {
    const { calls, impl } = stubFetch();

    expect(await syncLinkedIn({ config: NO_TOKEN, fetchImpl: impl })).toEqual(
      ZERO_RESULT,
    );
    expect(calls.posts).toBe(0);
  });

  test("records insufficient_scope and does not import when the probe is 403", async () => {
    const { calls, impl } = stubFetch({ posts: { status: 403 } });

    expect(await syncLinkedIn({ config: CONFIG, fetchImpl: impl })).toEqual(
      ZERO_RESULT,
    );
    expect(calls.posts).toBe(1);
    expect(await readTierCache()).toMatchObject({
      error: null,
      scopes: [],
      tier: "insufficient_scope",
    });
    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.lastStatus).toBe("not_configured");
  });

  test("imports posts and caches the active tier", async () => {
    const { calls, impl } = stubFetch({
      posts: [
        { body: { elements: [ELEMENT] }, status: 200 },
        { body: { elements: [ELEMENT] }, status: 200 },
      ],
    });

    const result = await syncLinkedIn({ config: CONFIG, fetchImpl: impl });

    expect(result).toEqual({ created: 1, error: null, skipped: 0, updated: 0 });
    expect(calls.posts).toBe(2);
    const [row] = await testDb.select().from(postsTable);
    expect(row).toMatchObject({
      body: ELEMENT.commentary,
      externalId: ELEMENT.id,
      externalUrl: ELEMENT.url,
      linkedinMeta: {
        permalink: ELEMENT.url,
        postedAt: "2026-11-01T10:00:00.000Z",
      },
      slug: "first-line",
      source: "linkedin",
      status: "published",
      tags: [],
      title: "First line",
    });

    const cached = await readTierCache();
    expect(cached).toMatchObject({
      error: null,
      scopes: ["r_member_social"],
      tier: "active",
    });
    expect((cached as { checkedAt: string }).checkedAt).toEqual(
      expect.any(String),
    );

    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.source).toBe("linkedin");
    expect(state?.lastStatus).toBe("ok");
    expect(state?.lastError).toBeNull();
  });

  test("a second active sync updates instead of duplicating", async () => {
    const active = () =>
      stubFetch({
        posts: { body: { elements: [ELEMENT] }, status: 200 },
      }).impl;

    await syncLinkedIn({ config: CONFIG, fetchImpl: active() });
    const second = await syncLinkedIn({ config: CONFIG, fetchImpl: active() });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(second.error).toBeNull();
    expect(await testDb.select().from(postsTable)).toHaveLength(1);
  });

  test("a 403 on the post fetch after an active probe is an error", async () => {
    const { impl } = stubFetch({
      posts: [{ body: { elements: [] }, status: 200 }, { status: 403 }],
    });

    const result = await syncLinkedIn({ config: CONFIG, fetchImpl: impl });

    expect(result).toEqual({
      created: 0,
      error: "linkedin_insufficient_scope",
      skipped: 0,
      updated: 0,
    });
    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.lastStatus).toBe("error");
    expect(state?.lastError).toBe("linkedin_insufficient_scope");
  });

  test("the scheduler is inert without an access token", () => {
    const originalNodeEnv = env.nodeEnv;
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}");
    }) as unknown as typeof fetch;

    try {
      // Bypass the test-mode guard so the no-token guard is what is exercised.
      env.nodeEnv = "development";
      startLinkedInScheduler(1);
    } finally {
      env.nodeEnv = originalNodeEnv;
      globalThis.fetch = originalFetch;
    }

    expect(calls).toBe(0);
  });
});

describe("getLinkedInStatus", () => {
  test("reports unconfigured without client credentials and makes no request", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await getLinkedInStatus({ config: NO_CREDENTIALS, fetchImpl: impl }),
    ).toEqual({
      message:
        "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable LinkedIn sync. Publishing from the admin panel works without them.",
      scopes: [],
      tier: "unconfigured",
    });
    expect(calls.posts).toBe(0);
  });

  test("reports manual without an access token and makes no request", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await getLinkedInStatus({ config: NO_TOKEN, fetchImpl: impl }),
    ).toEqual({
      message:
        "No LinkedIn access token configured. Publishing from the admin panel works; automatic sync is inactive.",
      scopes: [],
      tier: "manual",
    });
    expect(calls.posts).toBe(0);
  });

  test("reports an unprobed token without making a request", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await getLinkedInStatus({ config: CONFIG, fetchImpl: impl }),
    ).toEqual({
      message: PENDING_MESSAGE,
      scopes: [],
      tier: "manual",
    });
    expect(calls.posts).toBe(0);
  });

  test("reads the cached insufficient_scope tier and its exact message", async () => {
    await testDb.insert(settingsTable).values({
      key: "linkedin:tier",
      value: {
        checkedAt: "2026-11-07T12:00:00.000Z",
        error: null,
        scopes: [],
        tier: "insufficient_scope",
      },
    });

    expect(await getLinkedInStatus({ config: CONFIG })).toEqual({
      message:
        "The LinkedIn token does not carry r_member_social. Automatic sync stays inactive; publishing from the admin panel still works.",
      scopes: [],
      tier: "insufficient_scope",
    });
  });

  test("reads the cached active tier and reports no message", async () => {
    await testDb.insert(settingsTable).values({
      key: "linkedin:tier",
      value: {
        checkedAt: "2026-11-07T12:00:00.000Z",
        error: null,
        scopes: ["r_member_social"],
        tier: "active",
      },
    });

    expect(await getLinkedInStatus({ config: CONFIG })).toEqual({
      message: null,
      scopes: ["r_member_social"],
      tier: "active",
    });
  });

  test("reports a failed check instead of pretending no token is set", async () => {
    await testDb.insert(settingsTable).values({
      key: "linkedin:tier",
      value: {
        checkedAt: "2026-11-07T12:00:00.000Z",
        error: "linkedin_api_error",
        scopes: null,
        tier: "manual",
      },
    });

    expect(await getLinkedInStatus({ config: CONFIG })).toEqual({
      message: CHECK_FAILED_MESSAGE,
      scopes: [],
      tier: "manual",
    });
  });
});

describe("publishLinkedInPost", () => {
  test("creates a published linkedin post with its metadata", async () => {
    const summary = await publishLinkedInPost({
      body: "Hello world\nMore detail",
      permalink: "https://www.linkedin.com/posts/owner_1",
    });

    expect(summary).toMatchObject({
      externalUrl: "https://www.linkedin.com/posts/owner_1",
      linkedinMeta: {
        permalink: "https://www.linkedin.com/posts/owner_1",
        postedAt: expect.any(String),
      },
      slug: "hello-world",
      source: "linkedin",
      status: "published",
      tags: [],
      title: "Hello world",
    });
    expect(summary.publishedAt).not.toBeNull();
  });

  test("gives a second similar title a distinct slug", async () => {
    const first = await publishLinkedInPost({
      body: "Hello world",
      permalink: "https://www.linkedin.com/posts/owner_1",
    });
    const second = await publishLinkedInPost({
      body: "Hello world",
      permalink: "https://www.linkedin.com/posts/owner_2",
    });

    expect(first.slug).toBe("hello-world");
    expect(second.slug).toBe("hello-world-2");
  });

  test("rejects a permalink that is not an absolute http(s) URL", async () => {
    let caught: unknown;
    try {
      await publishLinkedInPost({
        body: "Hello world",
        permalink: "ftp://example.com/post",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ORPCError);
    if (!(caught instanceof ORPCError)) {
      throw new Error("expected an ORPCError");
    }
    expect(caught.code).toBe("BAD_REQUEST");
  });
});
