import { describe, expect, test } from "bun:test";
import {
  projectCreateSchema,
  projectSchema,
  projectUpdateSchema,
} from "./projects";

const PROJECT_ID = "0192f1c0-0000-7000-8000-000000000000";

const readProject = {
  body: "## The long version",
  bodyHtml: "<h2>The long version</h2>",
  coverImage: null,
  createdAt: "2026-11-08T00:00:00.000Z",
  featured: false,
  id: PROJECT_ID,
  liveUrl: null,
  repoUrl: null,
  slug: "project",
  sortOrder: 0,
  stack: [],
  status: "published" as const,
  summary: "A project.",
  title: "Project",
  updatedAt: "2026-11-08T00:00:00.000Z",
};

describe("projectSchema", () => {
  test("parses a read payload carrying rendered body html", () => {
    expect(projectSchema.parse(readProject).bodyHtml).toBe(
      "<h2>The long version</h2>",
    );
  });

  test("parses a read payload whose body is not rendered", () => {
    const parsed = projectSchema.parse({
      ...readProject,
      body: null,
      bodyHtml: null,
    });

    expect(parsed.bodyHtml).toBeNull();
  });
});

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
