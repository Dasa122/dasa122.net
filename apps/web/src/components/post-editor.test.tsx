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
  });

  test("disables the save button while a mutation is pending", () => {
    const html = renderToStaticMarkup(
      <PostEditor
        initial={empty}
        isPending={true}
        onPublish={() => {}}
        onSave={() => {}}
      />,
    );
    expect(html).toContain("disabled");
  });
});
