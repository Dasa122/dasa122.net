import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";
import type { SessionRecord } from "../auth/session";
import { sessionsTable } from "../database/schema";
import type { ApiContext } from "../middleware/context";
import { insertPostRepo, updatePostRepo } from "../modules/posts/repository";
import { appRouter } from "../router";
import { createTestDb, migrateTestDb, resetTables } from "./helpers";

/**
 * End-to-end tests over the real router, the way `Bun.serve` dispatches it:
 * oRPC validates each input and each handler runs against the test database.
 * The session comes from a real `sessions` row, so the admin gate exercises
 * the same `requireAdmin` path as production.
 */

const ADMIN_GROUP = "dasa122.net-admin";

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

function contextWith(session: SessionRecord | null): ApiContext {
  return {
    db: testDb,
    now: new Date(),
    request: new Request("http://localhost/api/rpc"),
    session,
  };
}

/** A client wired to `appRouter`, with the given session in its context. */
function client(session: SessionRecord | null = null) {
  return createRouterClient(appRouter, { context: contextWith(session) });
}

async function createSession(groups: string[]): Promise<SessionRecord> {
  const [row] = await testDb
    .insert(sessionsTable)
    .values({
      email: "owner@example.com",
      expiresAt: new Date(Date.now() + 3_600_000),
      groups,
      id: `session-${crypto.randomUUID()}`,
      name: "Owner",
      subject: "subject-1",
    })
    .returning();
  if (row === undefined) {
    throw new Error("session_insert_failed");
  }
  return row;
}

/** Runs a call expected to fail and returns its oRPC error code. */
async function errorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ORPCError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("expected the call to reject");
}

const ownDraft = {
  body: "Some body text.",
  source: "own" as const,
  title: "Hello World",
};

describe("anonymous access", () => {
  test("posts.list succeeds and returns the list envelope", async () => {
    const result = await client().posts.list({});
    expect(result).toEqual({ items: [], nextCursor: null, total: 0 });
  });

  test("adminStats.get is rejected with UNAUTHORIZED", async () => {
    expect(await errorCode(() => client().adminStats.get({}))).toBe(
      "UNAUTHORIZED",
    );
  });
});

describe("the admin group gate", () => {
  test("a session without the admin group is FORBIDDEN", async () => {
    const session = await createSession(["other"]);
    expect(await errorCode(() => client(session).adminStats.get({}))).toBe(
      "FORBIDDEN",
    );
  });

  test("a session in the admin group reads the stats", async () => {
    const session = await createSession([ADMIN_GROUP]);
    const stats = await client(session).adminStats.get({});
    expect(stats).toEqual({
      bySource: {},
      drafts: 0,
      lastSync: [],
      published: 0,
    });
  });
});

describe("post visibility", () => {
  test("a draft is invisible to posts.list and posts.bySlug", async () => {
    const admin = client(await createSession([ADMIN_GROUP]));
    await admin.adminPosts.create({ ...ownDraft, slug: "draft-post" });

    const feed = await client().posts.list({});
    expect(feed.total).toBe(0);
    expect(
      await errorCode(() => client().posts.bySlug({ slug: "draft-post" })),
    ).toBe("NOT_FOUND");
  });

  test("publishing makes a post visible and resolvable by slug", async () => {
    const admin = client(await createSession([ADMIN_GROUP]));
    const created = await admin.adminPosts.create(ownDraft);
    const published = await admin.adminPosts.publish({ id: created.id });

    if (published.slug === null) {
      throw new Error("expected a published slug");
    }

    const feed = await client().posts.list({});
    expect(feed.total).toBe(1);
    expect(feed.items[0]?.id).toBe(created.id);

    const post = await client().posts.bySlug({ slug: published.slug });
    expect(post.id).toBe(created.id);
    expect(post.bodyHtml).toContain("<p>");
  });

  test("a post with a future published_at is invisible to posts.list", async () => {
    const admin = client(await createSession([ADMIN_GROUP]));
    const created = await admin.adminPosts.create(ownDraft);
    const published = await admin.adminPosts.publish({ id: created.id });

    await updatePostRepo(testDb, created.id, {
      publishedAt: new Date(Date.now() + 86_400_000),
    });

    const feed = await client().posts.list({});
    expect(feed.total).toBe(0);

    const slug = published.slug;
    expect(slug).not.toBeNull();
    if (slug !== null) {
      expect(await errorCode(() => client().posts.bySlug({ slug }))).toBe(
        "NOT_FOUND",
      );
    }
  });

  test("two posts with the same title get distinct slugs when published", async () => {
    const admin = client(await createSession([ADMIN_GROUP]));
    const first = await admin.adminPosts.create(ownDraft);
    const second = await admin.adminPosts.create(ownDraft);

    const firstPublished = await admin.adminPosts.publish({ id: first.id });
    const secondPublished = await admin.adminPosts.publish({ id: second.id });

    expect(firstPublished.slug).not.toBeNull();
    expect(secondPublished.slug).not.toBeNull();
    expect(firstPublished.slug).not.toBe(secondPublished.slug);

    const feed = await client().posts.list({});
    expect(feed.total).toBe(2);
  });
});

describe("the posts repository", () => {
  test("updatedAt advances on update without the caller setting it", async () => {
    const created = await insertPostRepo(testDb, {
      source: "own",
      title: "Before",
    });

    // `$onUpdate` stamps a fresh `new Date()`; the wait keeps that stamp
    // strictly later than `defaultNow()`'s timestamp even on a fast machine.
    await Bun.sleep(10);

    const updated = await updatePostRepo(testDb, created.id, {
      title: "After",
    });
    if (updated === null) {
      throw new Error("expected the row to be updated");
    }

    expect(updated.title).toBe("After");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );
  });

  test("rejects a duplicate (source, external_id)", async () => {
    const row = {
      externalId: "dasa122.net:12345",
      source: "github",
      title: "Pushed to dasa122.net",
    };
    await insertPostRepo(testDb, row);
    await expect(insertPostRepo(testDb, row)).rejects.toThrow();
  });

  test("accepts the same source with different external_ids", async () => {
    const first = await insertPostRepo(testDb, {
      externalId: "dasa122.net:1",
      source: "github",
      title: "First push",
    });
    const second = await insertPostRepo(testDb, {
      externalId: "dasa122.net:2",
      source: "github",
      title: "Second push",
    });

    expect(first.id).not.toBe(second.id);
  });

  test("accepts several own posts with a NULL external_id", async () => {
    const first = await insertPostRepo(testDb, {
      externalId: null,
      source: "own",
      title: "Hand written one",
    });
    const second = await insertPostRepo(testDb, {
      externalId: null,
      source: "own",
      title: "Hand written two",
    });

    expect(first.id).not.toBe(second.id);
  });
});
