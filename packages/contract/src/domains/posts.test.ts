import { describe, expect, test } from "bun:test";
import { postSummarySchema } from "./posts";

describe("postSummarySchema", () => {
  test("rejects a post whose publishedAt is not an ISO datetime", () => {
    const result = postSummarySchema.safeParse({
      coverImage: null,
      createdAt: "2026-11-07T10:00:00.000Z",
      excerpt: "A post.",
      externalUrl: null,
      githubMeta: null,
      id: "0192f1c0-0000-7000-8000-000000000000",
      linkedinMeta: null,
      publishedAt: "yesterday",
      readTimeMin: 1,
      slug: "hello",
      source: "own",
      status: "published",
      tags: [],
      title: "Hello",
      updatedAt: "2026-11-07T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  test("accepts an own post with no external metadata", () => {
    const result = postSummarySchema.safeParse({
      coverImage: null,
      createdAt: "2026-11-07T10:00:00.000Z",
      excerpt: "A post.",
      externalUrl: null,
      githubMeta: null,
      id: "0192f1c0-0000-7000-8000-000000000000",
      linkedinMeta: null,
      publishedAt: "2026-11-07T10:00:00.000Z",
      readTimeMin: 1,
      slug: "hello",
      source: "own",
      status: "published",
      tags: [],
      title: "Hello",
      updatedAt: "2026-11-07T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
