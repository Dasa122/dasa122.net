import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import {
  adminCreatePost,
  adminDeletePost,
  adminListPosts,
  adminPublishPost,
  adminUnpublishPost,
  adminUpdatePost,
  getPublishedPostBySlug,
  getRelatedPosts,
  listPublishedPosts,
} from "./service";

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

const ownPost = {
  body: "Some body text.",
  coverImage: null,
  excerpt: null,
  externalUrl: null,
  linkedinPermalink: null,
  slug: null,
  source: "own" as const,
  tags: [] as string[],
  title: "Hello World",
};

function requiredSlug(value: string | null): string {
  if (value === null) {
    throw new Error("expected a published slug");
  }
  return value;
}

describe("posts service", () => {
  test("a draft is not listed", async () => {
    await adminCreatePost(ownPost);
    const feed = await listPublishedPosts({ limit: 20 });
    expect(feed.total).toBe(0);
  });

  test("a published post is listed and resolvable by slug", async () => {
    const created = await adminCreatePost(ownPost);
    await adminPublishPost(created.id);
    const feed = await listPublishedPosts({ limit: 20 });
    expect(feed.total).toBe(1);
    const first = feed.items.at(0);
    if (first === undefined) {
      throw new Error("expected a listed post");
    }
    const post = await getPublishedPostBySlug(requiredSlug(first.slug));
    expect(post?.title).toBe("Hello World");
    expect(post?.bodyHtml).toContain("<p>");
  });

  test("a future-dated post is not listed and is not resolvable by slug", async () => {
    const created = await adminCreatePost(ownPost);
    const published = await adminPublishPost(
      created.id,
      new Date(Date.now() + 86_400_000),
    );
    const feed = await listPublishedPosts({ limit: 20 });
    expect(feed.total).toBe(0);
    expect(
      await getPublishedPostBySlug(requiredSlug(published.slug)),
    ).toBeNull();
  });

  test("publishing two posts with the same title gives distinct slugs", async () => {
    const a = await adminCreatePost(ownPost);
    const b = await adminCreatePost(ownPost);
    const publishedA = await adminPublishPost(a.id);
    const publishedB = await adminPublishPost(b.id);
    expect(publishedA.slug).not.toBe(publishedB.slug);
    expect(publishedA.slug).toBe("hello-world");
    expect(publishedB.slug).toBe("hello-world-2");
  });

  test("a post with no body gets a generated excerpt and reading time", async () => {
    const created = await adminCreatePost({ ...ownPost, body: null });
    expect(created.excerpt).toBe("");
    expect(created.readTimeMin).toBe(1);
  });

  test("unpublishing clears the slug so it can be reused", async () => {
    const created = await adminCreatePost(ownPost);
    const published = await adminPublishPost(created.id);
    expect(published.slug).toBe("hello-world");

    const unpublished = await adminUnpublishPost(created.id);
    expect(unpublished.slug).toBeNull();
    expect(unpublished.publishedAt).toBeNull();
    expect(unpublished.status).toBe("draft");
    expect((await listPublishedPosts({ limit: 20 })).total).toBe(0);

    const republished = await adminPublishPost(created.id);
    expect(republished.slug).toBe("hello-world");
  });

  test("cursor pagination walks the feed newest first", async () => {
    const titles = ["First", "Second", "Third"];
    for (const [index, title] of titles.entries()) {
      const post = await adminCreatePost({ ...ownPost, title });
      await adminPublishPost(post.id, new Date(Date.UTC(2024, 0, index + 1)));
    }

    const first = await listPublishedPosts({ limit: 2 });
    expect(first.items.map((item) => item.title)).toEqual(["Third", "Second"]);
    const cursor = first.nextCursor;
    if (cursor === null) {
      throw new Error("expected a next cursor");
    }

    const second = await listPublishedPosts({ cursor, limit: 2 });
    expect(second.items.map((item) => item.title)).toEqual(["First"]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBe(3);
  });

  test("the year filter matches the physical published_at column", async () => {
    const post = await adminCreatePost({ ...ownPost, title: "Old post" });
    await adminPublishPost(post.id, new Date("2024-05-01T12:00:00.000Z"));

    expect((await listPublishedPosts({ limit: 20, year: 2024 })).total).toBe(1);
    expect((await listPublishedPosts({ limit: 20, year: 2025 })).total).toBe(0);
  });

  test("the admin list includes drafts and never renders bodyHtml", async () => {
    const draft = await adminCreatePost(ownPost);
    const published = await adminCreatePost({
      ...ownPost,
      title: "Published",
    });
    await adminPublishPost(published.id);

    const list = await adminListPosts({ limit: 20 });
    expect(list.total).toBe(2);
    expect(list.items.map((item) => item.id)).toContain(draft.id);
    for (const item of list.items) {
      expect(item.bodyHtml).toBeNull();
      expect(item.body).toBe("Some body text.");
    }
  });

  test("related posts share a tag and exclude the post itself", async () => {
    const a = await adminCreatePost({ ...ownPost, tags: ["drizzle"] });
    const b = await adminCreatePost({
      ...ownPost,
      tags: ["drizzle", "bun"],
      title: "Another",
    });
    const c = await adminCreatePost({
      ...ownPost,
      tags: ["unrelated"],
      title: "Unrelated",
    });
    const publishedA = await adminPublishPost(a.id);
    await adminPublishPost(b.id);
    await adminPublishPost(c.id);

    const related = await getRelatedPosts(requiredSlug(publishedA.slug), 5);
    expect(related.map((item) => item.title)).toEqual(["Another"]);
    expect(related.some((item) => item.id === publishedA.id)).toBe(false);
  });

  test("updating the body regenerates the excerpt and reading time", async () => {
    const created = await adminCreatePost(ownPost);
    const updated = await adminUpdatePost(created.id, {
      body: `${"word ".repeat(221)}`,
      id: created.id,
    });
    expect(updated.readTimeMin).toBe(2);
    expect(updated.excerpt?.startsWith("word word")).toBe(true);
  });

  test("deleting a missing post throws NOT_FOUND", async () => {
    await expect(
      Promise.resolve(adminDeletePost("00000000-0000-4000-8000-000000000000")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("a duplicate explicit slug on create is CONFLICT", async () => {
    await adminCreatePost({ ...ownPost, slug: "taken" });

    await expect(
      Promise.resolve(
        adminCreatePost({ ...ownPost, slug: "taken", title: "Other" }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("a duplicate explicit slug on update is CONFLICT, but clearing is allowed", async () => {
    const first = await adminCreatePost({ ...ownPost, slug: "first" });
    const second = await adminCreatePost({
      ...ownPost,
      slug: "second",
      title: "Second",
    });

    await expect(
      Promise.resolve(
        adminUpdatePost(second.id, { id: second.id, slug: "first" }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const cleared = await adminUpdatePost(first.id, {
      id: first.id,
      slug: null,
    });
    expect(cleared.slug).toBeNull();
  });

  test("patching a missing post with a taken slug is NOT_FOUND", async () => {
    await adminCreatePost({ ...ownPost, slug: "taken" });

    await expect(
      Promise.resolve(
        adminUpdatePost("00000000-0000-4000-8000-000000000000", {
          id: "00000000-0000-4000-8000-000000000000",
          slug: "taken",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("patching only a LinkedIn permalink on an own post keeps metadata null", async () => {
    const created = await adminCreatePost(ownPost);

    const updated = await adminUpdatePost(created.id, {
      id: created.id,
      linkedinPermalink: "https://www.linkedin.com/posts/x",
    });

    expect(updated.linkedinMeta).toBeNull();
  });

  test("patching a permalink on a LinkedIn post uses its stored source", async () => {
    const created = await adminCreatePost({
      ...ownPost,
      linkedinPermalink: "https://www.linkedin.com/posts/y",
      source: "linkedin",
    });

    const updated = await adminUpdatePost(created.id, {
      id: created.id,
      linkedinPermalink: "https://www.linkedin.com/posts/z",
    });

    expect(updated.linkedinMeta?.permalink).toBe(
      "https://www.linkedin.com/posts/z",
    );
  });

  test("the search filter escapes LIKE wildcards", async () => {
    const posts = [
      await adminCreatePost({ ...ownPost, title: "100% real" }),
      await adminCreatePost({ ...ownPost, title: "100x real" }),
      await adminCreatePost({ ...ownPost, title: "ab_c" }),
      await adminCreatePost({ ...ownPost, title: "abxc" }),
    ];
    for (const post of posts) {
      await adminPublishPost(post.id);
    }

    expect(
      (await listPublishedPosts({ limit: 20, q: "100%" })).items.map(
        (item) => item.title,
      ),
    ).toEqual(["100% real"]);
    expect(
      (await listPublishedPosts({ limit: 20, q: "ab_c" })).items.map(
        (item) => item.title,
      ),
    ).toEqual(["ab_c"]);
  });
});
