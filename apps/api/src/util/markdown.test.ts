import { describe, expect, test } from "bun:test";
import { renderMarkdown, sanitizeHtml } from "./markdown";

describe("sanitizeHtml", () => {
  test("removes a script element and its content", () => {
    expect(sanitizeHtml("<p>ok</p><script>alert(1)</script>")).toBe(
      "<p>ok</p>",
    );
    expect(sanitizeHtml("<script>alert(1)</script>")).not.toContain("alert(1)");
  });

  test("removes an iframe element and its content", () => {
    expect(
      sanitizeHtml('<iframe src="https://evil.example"></iframe><p>ok</p>'),
    ).toBe("<p>ok</p>");
    expect(
      sanitizeHtml('<iframe src="https://evil.example">fallback</iframe>'),
    ).not.toContain("fallback");
  });

  test("removes every blocked element together with its content", () => {
    for (const tag of ["style", "object", "embed", "form"]) {
      expect(sanitizeHtml(`<${tag}>danger</${tag}>`)).not.toContain("danger");
    }
  });

  test("neutralises a javascript: link", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:",
    );
  });

  test("neutralises an unquoted javascript: src", () => {
    expect(sanitizeHtml("<img src=javascript:alert(1)>")).not.toContain(
      "javascript:",
    );
  });
});

describe("renderMarkdown", () => {
  test("renders a heading", async () => {
    const html = await renderMarkdown("# Hello");
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello");
  });

  test("strips script tags and their contents from the rendered output", async () => {
    const html = await renderMarkdown("Hello\n\n<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  test("strips iframe tags and their contents from the rendered output", async () => {
    const html = await renderMarkdown(
      '<iframe src="https://evil.example">fallback</iframe>',
    );
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("fallback");
  });

  test("neutralises a javascript: href in markdown", async () => {
    const html = await renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  test("highlights a fenced code block with shiki", async () => {
    const html = await renderMarkdown("```ts\nconst answer = 42;\n```");
    expect(html).toContain("shiki");
    expect(html).toContain("answer");
  });

  test("escapes an img onerror rather than passing it through", async () => {
    const html = await renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  test("escapes an svg onload", async () => {
    const html = await renderMarkdown('<svg onload="alert(1)"></svg>');
    expect(html).not.toContain("onload");
  });

  test("neutralises an entity-encoded javascript: href", async () => {
    const html = await renderMarkdown("[x](&#106;avascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  test("neutralises a whitespace-prefixed entity-encoded javascript: href", async () => {
    const html = await renderMarkdown("[x](&#9;javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  test("still highlights fenced code through shiki", async () => {
    const html = await renderMarkdown("```ts\nconst x: number = 1\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("shiki");
  });

  test("leaves legitimate markdown markup intact", async () => {
    const html = await renderMarkdown(
      "# Title\n\nSome **bold** and *em* with [a link](https://example.com) and `inline`.",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<code>inline</code>");
  });
});
