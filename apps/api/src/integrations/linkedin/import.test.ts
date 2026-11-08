import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { ORPCError } from "@orpc/server";
import { postsTable } from "../../database/schema";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import { extractPostId, fetchPublicPost, importLinkedInPost } from "./import";

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

const ACTIVITY_ID = "7454807727056519168";
const POST_URL = `https://www.linkedin.com/posts/gergokovago_why-linkedin-matters-activity-${ACTIVITY_ID}-AbCd?utm_source=share#comments`;
const EMBED_URL = `https://www.linkedin.com/embed/feed/update/urn:li:activity:${ACTIVITY_ID}`;
const CANONICAL_URL = `https://www.linkedin.com/feed/update/urn:li:activity:${ACTIVITY_ID}/`;

/** A trimmed copy of the real embed's meta tag, with entities and an ellipsis. */
const EMBED_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="pageKey" content="d_public_post_embed">
    <meta name="description" content="Why does LinkedIn matter&nbsp;now?

Because attention has shifted from brands to people &amp; real voices stand out.

Your LinkedIn isn&#8217;t just a profile anymore&#8230;">
    <meta property="og:description" content="Not the one to use.">
  </head>
</html>`;

const EXPECTED_TEXT = `Why does LinkedIn matter now?

Because attention has shifted from brands to people & real voices stand out.

Your LinkedIn isn’t just a profile anymore`;

function stubFetch(status: number, html = EMBED_HTML): FetchImpl {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url !== EMBED_URL) {
      throw new Error(`unexpected request: ${url}`);
    }
    return new Response(status === 200 ? html : "", { status });
  }) as FetchImpl;
}

async function caughtFrom(
  run: () => Promise<unknown>,
): Promise<ORPCError<string, unknown>> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    if (error instanceof ORPCError) {
      return error as ORPCError<string, unknown>;
    }
  }
  throw new Error("expected an ORPCError");
}

describe("extractPostId", () => {
  test("reads the activity from a post permalink", () => {
    expect(extractPostId(POST_URL)).toBe(ACTIVITY_ID);
  });

  test("reads the activity from an embed URL", () => {
    expect(extractPostId(EMBED_URL)).toBe(ACTIVITY_ID);
  });

  test("ignores the query string and fragment", () => {
    expect(extractPostId(`${EMBED_URL}?trk=public_post#top`)).toBe(ACTIVITY_ID);
  });

  test("rejects a profile URL", () => {
    expect(
      extractPostId("https://www.linkedin.com/in/gergokovago/"),
    ).toBeNull();
  });

  test("rejects a javascript: URL", () => {
    expect(
      extractPostId(`javascript:alert('urn:li:activity:${ACTIVITY_ID}')`),
    ).toBeNull();
  });

  test("rejects a non-LinkedIn host", () => {
    expect(
      extractPostId(
        `https://example.com/posts/slug-activity-${ACTIVITY_ID}-AbCd`,
      ),
    ).toBeNull();
  });
});

describe("fetchPublicPost", () => {
  test("decodes entities, keeps paragraphs and trims the ellipsis", async () => {
    const post = await fetchPublicPost(ACTIVITY_ID, stubFetch(200));

    expect(post).toEqual({ postedAt: null, text: EXPECTED_TEXT });
  });

  test("maps a non-200 embed response to linkedin_fetch_failed", async () => {
    let caught: unknown;
    try {
      await fetchPublicPost(ACTIVITY_ID, stubFetch(403));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("linkedin_fetch_failed");
  });
});

describe("importLinkedInPost", () => {
  test("creates a published LinkedIn post from the embed text", async () => {
    const post = await importLinkedInPost(
      { permalink: POST_URL },
      { database: testDb, fetchImpl: stubFetch(200) },
    );

    expect(post).toMatchObject({
      externalUrl: CANONICAL_URL,
      linkedinMeta: { permalink: POST_URL, postedAt: null },
      source: "linkedin",
      status: "published",
      tags: [],
      title: "Why does LinkedIn matter now?",
    });

    const [row] = await testDb.select().from(postsTable);
    expect(row?.body).toBe(EXPECTED_TEXT);
  });

  test("importing the same permalink twice creates one post", async () => {
    const first = await importLinkedInPost(
      { permalink: POST_URL },
      { database: testDb, fetchImpl: stubFetch(200) },
    );
    const second = await importLinkedInPost(
      { permalink: EMBED_URL },
      { database: testDb, fetchImpl: stubFetch(200) },
    );

    expect(second.id).toBe(first.id);
    expect(await testDb.select().from(postsTable)).toHaveLength(1);
  });

  test("matches a post that already stores the pasted permalink", async () => {
    const [seeded] = await testDb
      .insert(postsTable)
      .values({
        body: "Manually published",
        externalUrl: POST_URL,
        linkedinMeta: { permalink: POST_URL, postedAt: null },
        publishedAt: new Date("2026-11-01T10:00:00.000Z"),
        readTimeMin: 1,
        slug: "manually-published",
        source: "linkedin",
        status: "published",
        tags: [],
        title: "Manually published",
      })
      .returning();

    const post = await importLinkedInPost(
      { permalink: POST_URL },
      {
        database: testDb,
        fetchImpl: (async () => {
          throw new Error("linkedin should not be fetched for a duplicate");
        }) as unknown as FetchImpl,
      },
    );

    if (seeded === undefined) {
      throw new Error("seed insert returned no row");
    }
    expect(post.id).toBe(seeded.id);
    expect(await testDb.select().from(postsTable)).toHaveLength(1);
  });

  test("maps a non-200 embed to BAD_GATEWAY", async () => {
    const error = await caughtFrom(() =>
      importLinkedInPost(
        { permalink: POST_URL },
        { database: testDb, fetchImpl: stubFetch(500) },
      ),
    );

    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toContain("Could not read that post");
  });

  test("maps an unparseable URL to BAD_REQUEST", async () => {
    const error = await caughtFrom(() =>
      importLinkedInPost(
        { permalink: "https://www.linkedin.com/in/gergokovago/" },
        { database: testDb, fetchImpl: stubFetch(200) },
      ),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });
});
