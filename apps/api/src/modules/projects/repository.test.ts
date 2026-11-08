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
  adminCreateProject,
  adminUpdateProject,
  getPublishedProjectBySlug,
  listPublishedProjects,
} from "./repository";

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

const project = (title: string, sortOrder = 0) => ({
  body: null,
  coverImage: null,
  featured: false,
  liveUrl: null,
  repoUrl: null,
  sortOrder,
  stack: [],
  summary: `About ${title}`,
  title,
});

describe("projects", () => {
  test("a created project is published and appears in the public list", async () => {
    const created = await adminCreateProject(project("Showcase"));

    expect(created.status).toBe("published");
    const published = await listPublishedProjects();
    expect(published.map((item) => item.id)).toEqual([created.id]);
  });

  test("updating a project keeps it published and in display order", async () => {
    const second = await adminCreateProject(project("Second", 2));
    const first = await adminCreateProject(project("First", 1));

    const updated = await adminUpdateProject(second.id, {
      featured: true,
      id: second.id,
    });

    expect(updated.status).toBe("published");
    const published = await listPublishedProjects();
    expect(published.map((item) => item.slug)).toEqual([
      first.slug,
      second.slug,
    ]);
  });

  test("a project with a markdown body renders bodyHtml on read", async () => {
    const created = await adminCreateProject({
      ...project("With body"),
      body: "## The long version\n\nSome **bold** prose.",
    });

    const detail = await getPublishedProjectBySlug(created.slug);

    expect(detail?.bodyHtml).toContain("<h2>The long version</h2>");
    expect(detail?.bodyHtml).toContain("<strong>bold</strong>");
  });

  test("a project without a body has no bodyHtml", async () => {
    const missing = await adminCreateProject(project("No body"));
    const empty = await adminCreateProject({
      ...project("Empty body"),
      body: "   ",
    });

    expect(
      (await getPublishedProjectBySlug(missing.slug))?.bodyHtml,
    ).toBeNull();
    expect((await getPublishedProjectBySlug(empty.slug))?.bodyHtml).toBeNull();
  });

  test("a script in the body is sanitised out of bodyHtml", async () => {
    const created = await adminCreateProject({
      ...project("Script"),
      body: "Hello\n\n<script>alert(1)</script>",
    });

    const detail = await getPublishedProjectBySlug(created.slug);

    expect(detail?.bodyHtml).not.toContain("<script");
    expect(detail?.bodyHtml).not.toContain("alert(1)");
  });
});
