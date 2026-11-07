import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { ORPCError } from "@orpc/server";
import { postsTable, syncStateTable } from "../../database/schema";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import { getLinkedInStatus, publishLinkedInPost, syncLinkedIn } from "./sync";

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

type Calls = { grants: number; posts: number };

type StubOptions = {
  grants?: { name?: string; scope?: string } | { status: number };
  posts?: { status: number } | unknown[];
};

/** Routes each LinkedIn endpoint and records how often it was called. */
function stubFetch(options: StubOptions = {}) {
  const calls: Calls = { grants: 0, posts: 0 };
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/v2/userinfo")) {
      calls.grants += 1;
      const grants = options.grants ?? { scope: "r_member_social" };
      if ("status" in grants) {
        return new Response("{}", {
          status: (grants as { status: number }).status,
        });
      }
      return jsonResponse({
        name: grants.name ?? "Owner",
        scope: grants.scope,
      });
    }
    if (url.includes("/rest/posts")) {
      calls.posts += 1;
      const posts = options.posts ?? [];
      if (!Array.isArray(posts)) {
        return new Response("{}", {
          status: (posts as { status: number }).status,
        });
      }
      return jsonResponse({ elements: posts });
    }
    return jsonResponse({});
  }) as unknown as FetchImpl;
  return { calls, impl };
}

const ELEMENT = {
  commentary: "First line\nSecond line of the post",
  id: "urn:li:share:1",
  publishedAt: "2026-11-01T10:00:00.000Z",
  url: "https://www.linkedin.com/posts/owner_1",
};

describe("syncLinkedIn", () => {
  test("is unconfigured without credentials and makes no request", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await syncLinkedIn({ config: NO_CREDENTIALS, fetchImpl: impl }),
    ).toEqual(ZERO_RESULT);
    expect(calls).toEqual({ grants: 0, posts: 0 });
  });

  test("is manual without a token and makes no request", async () => {
    const { calls, impl } = stubFetch();

    expect(await syncLinkedIn({ config: NO_TOKEN, fetchImpl: impl })).toEqual(
      ZERO_RESULT,
    );
    expect(calls).toEqual({ grants: 0, posts: 0 });
  });

  test("never calls the posts endpoint when the token lacks r_member_social", async () => {
    const { calls, impl } = stubFetch({
      grants: { scope: "r_liteprofile" },
    });

    expect(await syncLinkedIn({ config: CONFIG, fetchImpl: impl })).toEqual(
      ZERO_RESULT,
    );
    expect(calls).toEqual({ grants: 1, posts: 0 });
  });

  test("imports posts when the token is active", async () => {
    const { impl } = stubFetch({ posts: [ELEMENT] });

    const result = await syncLinkedIn({ config: CONFIG, fetchImpl: impl });

    expect(result).toEqual({ created: 1, error: null, skipped: 0, updated: 0 });
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

    const [state] = await testDb.select().from(syncStateTable);
    expect(state?.source).toBe("linkedin");
    expect(state?.lastStatus).toBe("ok");
    expect(state?.lastError).toBeNull();
  });

  test("a second active sync updates instead of duplicating", async () => {
    await syncLinkedIn({
      config: CONFIG,
      fetchImpl: stubFetch({ posts: [ELEMENT] }).impl,
    });
    const second = await syncLinkedIn({
      config: CONFIG,
      fetchImpl: stubFetch({ posts: [ELEMENT] }).impl,
    });

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(second.error).toBeNull();
    expect(await testDb.select().from(postsTable)).toHaveLength(1);
  });

  test("a 403 from LinkedIn becomes linkedin_insufficient_scope", async () => {
    const { impl } = stubFetch({
      grants: { scope: "r_member_social" },
      posts: { status: 403 },
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
});

describe("getLinkedInStatus", () => {
  test("reports unconfigured without client credentials", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await getLinkedInStatus({ config: NO_CREDENTIALS, fetchImpl: impl }),
    ).toEqual({
      message:
        "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable LinkedIn sync. Publishing from the admin panel works without them.",
      scopes: [],
      tier: "unconfigured",
    });
    expect(calls.grants).toBe(0);
  });

  test("reports manual without an access token", async () => {
    const { calls, impl } = stubFetch();

    expect(
      await getLinkedInStatus({ config: NO_TOKEN, fetchImpl: impl }),
    ).toEqual({
      message:
        "No LinkedIn access token configured. Publishing from the admin panel works; automatic sync is inactive.",
      scopes: [],
      tier: "manual",
    });
    expect(calls.grants).toBe(0);
  });

  test("reports the exact insufficient_scope message and granted scopes", async () => {
    const { impl } = stubFetch({
      grants: { scope: "r_liteprofile r_basicprofile" },
    });

    expect(
      await getLinkedInStatus({ config: CONFIG, fetchImpl: impl }),
    ).toEqual({
      message:
        "The LinkedIn token does not carry r_member_social. Automatic sync stays inactive; publishing from the admin panel still works.",
      scopes: ["r_liteprofile", "r_basicprofile"],
      tier: "insufficient_scope",
    });
  });

  test("an active token carries no message", async () => {
    const { impl } = stubFetch({ grants: { scope: "r_member_social" } });

    expect(
      await getLinkedInStatus({ config: CONFIG, fetchImpl: impl }),
    ).toEqual({
      message: null,
      scopes: ["r_member_social"],
      tier: "active",
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
