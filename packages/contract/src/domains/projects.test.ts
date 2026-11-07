import { describe, expect, test } from "bun:test";
import { projectCreateSchema, projectUpdateSchema } from "./projects";

const PROJECT_ID = "0192f1c0-0000-7000-8000-000000000000";

describe("projectCreateSchema", () => {
  test("applies the documented defaults", () => {
    const parsed = projectCreateSchema.parse({
      summary: "A project.",
      title: "Project",
    });

    expect(parsed).toEqual({
      body: null,
      coverImage: null,
      featured: false,
      liveUrl: null,
      repoUrl: null,
      sortOrder: 0,
      stack: [],
      summary: "A project.",
      title: "Project",
    });
  });
});

describe("projectUpdateSchema", () => {
  test("a title-only patch carries none of the create defaults", () => {
    const parsed = projectUpdateSchema.parse({
      id: PROJECT_ID,
      title: "Only the title",
    });

    expect(parsed).toEqual({ id: PROJECT_ID, title: "Only the title" });
    for (const key of ["body", "featured", "sortOrder", "stack"]) {
      expect(Object.hasOwn(parsed, key)).toBe(false);
    }
  });

  test("accepts an explicit null so a URL can be cleared", () => {
    const parsed = projectUpdateSchema.parse({ id: PROJECT_ID, liveUrl: null });

    expect(parsed.liveUrl).toBeNull();
    expect(parsed).toEqual({ id: PROJECT_ID, liveUrl: null });
  });
});
