import { describe, expect, test } from "bun:test";
import { postCreateSchema, postUpdateSchema } from "./posts";

const POST_ID = "0192f1c0-0000-7000-8000-000000000000";

describe("postCreateSchema", () => {
  test("applies the documented defaults", () => {
    const parsed = postCreateSchema.parse({ source: "own", title: "Hello" });

    expect(parsed).toEqual({
      body: null,
      coverImage: null,
      excerpt: null,
      externalUrl: null,
      linkedinPermalink: null,
      slug: null,
      source: "own",
      tags: [],
      title: "Hello",
    });
  });
});

describe("postUpdateSchema", () => {
  test("omitted fields stay omitted instead of taking create defaults", () => {
    const parsed = postUpdateSchema.parse({
      id: POST_ID,
      title: "Only the title",
    });

    expect(parsed).toEqual({ id: POST_ID, title: "Only the title" });
  });

  test("accepts an explicit null so a nullable field can be cleared", () => {
    const parsed = postUpdateSchema.parse({ excerpt: null, id: POST_ID });

    expect(parsed.excerpt).toBeNull();
    expect(parsed).toEqual({ excerpt: null, id: POST_ID });
  });
});
