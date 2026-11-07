import { describe, expect, test } from "bun:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { PostRow } from "./post-row";

const post = {
  coverImage: null,
  createdAt: "2026-11-07T10:00:00.000Z",
  excerpt: "A short note.",
  externalUrl: null,
  githubMeta: null,
  id: "0192f1c0-0000-7000-8000-000000000000",
  linkedinMeta: null,
  publishedAt: "2026-11-07T10:00:00.000Z",
  readTimeMin: 2,
  slug: "hello",
  source: "own" as const,
  status: "published" as const,
  tags: ["release"],
  title: "Hello",
  updatedAt: "2026-11-07T10:00:00.000Z",
};

/** Render the row inside a real router, as it ships. */
async function renderRow(): Promise<string> {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({
      component: () => <PostRow post={post} />,
    }),
  });
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("PostRow", () => {
  test("renders the title, the source badge and the reading time", async () => {
    const html = await renderRow();
    expect(html).toContain("Hello");
    expect(html).toContain("NOTE");
    expect(html).toContain("2 min");
  });

  test("links to the post slug", async () => {
    const html = await renderRow();
    expect(html).toContain('href="/news/hello"');
  });
});
