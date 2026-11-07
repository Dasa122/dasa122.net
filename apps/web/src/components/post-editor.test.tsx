import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PostEditor } from "./post-editor";

const empty = {
  body: "",
  coverImage: "",
  excerpt: "",
  id: null,
  source: "own" as const,
  status: "draft" as const,
  tags: [],
  title: "",
};

describe("PostEditor", () => {
  test("renders the title field", () => {
    const html = renderToStaticMarkup(
      <PostEditor
        initial={empty}
        isPending={false}
        onPublish={() => {}}
        onSave={() => {}}
      />,
    );
    expect(html).toContain("Title");
    expect(html).not.toContain('disabled=""');
  });

  test("disables both actions while a mutation is pending", () => {
    const html = renderToStaticMarkup(
      <PostEditor
        initial={empty}
        isPending={true}
        onPublish={() => {}}
        onSave={() => {}}
      />,
    );
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });
});
