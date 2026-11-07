import { describe, expect, test } from "bun:test";
import { deriveExcerpt, readingTimeMinutes } from "./excerpt";

describe("deriveExcerpt", () => {
  test("strips markdown emphasis and headings", () => {
    expect(deriveExcerpt("# Title\n\nSome **bold** text.")).toBe(
      "Title Some bold text.",
    );
  });

  test("collapses a markdown link to its text", () => {
    expect(deriveExcerpt("See [the docs](https://example.com).")).toBe(
      "See the docs.",
    );
  });

  test("truncates on a word boundary and appends an ellipsis", () => {
    const result = deriveExcerpt("word ".repeat(100), 30);
    expect(result.length).toBeLessThanOrEqual(31);
    expect(result.endsWith("…")).toBe(true);
  });

  test("leaves short text untouched", () => {
    expect(deriveExcerpt("short")).toBe("short");
  });
});

describe("readingTimeMinutes", () => {
  test("is at least one minute for an empty body", () => {
    expect(readingTimeMinutes("")).toBe(1);
  });

  test("is one minute for 220 words or fewer", () => {
    expect(readingTimeMinutes("word ".repeat(220))).toBe(1);
  });

  test("is two minutes for 221 words", () => {
    expect(readingTimeMinutes("word ".repeat(221))).toBe(2);
  });
});
