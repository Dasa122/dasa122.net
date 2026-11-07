import { describe, expect, test } from "bun:test";
import { parseMediaFilename, sanitizeFilename } from "./filename";

describe("parseMediaFilename", () => {
  const cases: Array<[string, string | null]> = [
    ["cover.png", "cover.png"],
    ["%2f", null],
    ["%2e%2e%2f", null],
    ["%5c", null],
    ["%252e", "%2e"],
    ["%c0%ae", null],
    ["..", null],
    ["", null],
    ["a%00b", null],
    ["%00", null],
    ["%2e", null],
    [".", null],
  ];

  for (const [input, expected] of cases) {
    test(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(parseMediaFilename(input)).toBe(expected);
    });
  }
});

describe("sanitizeFilename", () => {
  test("collapses dot runs and trims edge dots", () => {
    expect(sanitizeFilename("a..b.png")).toBe("a.b.png");
    expect(sanitizeFilename("..cover.png")).toBe("cover.png");
    expect(sanitizeFilename("cover.png..")).toBe("cover.png");
  });

  test("replaces unsafe runs and lowercases", () => {
    expect(sanitizeFilename("My Cover (1).PNG")).toBe("my-cover-1-.png");
  });

  test("falls back to a random name when nothing survives", () => {
    const name = sanitizeFilename("...");
    expect(name).not.toBe("");
    expect(parseMediaFilename(name)).toBe(name);
  });

  test("every sanitised name passes the route guard", () => {
    for (const input of ["a..b.png", "..cover.png", "x y z.jpeg", "..."]) {
      const name = sanitizeFilename(input);
      expect(parseMediaFilename(name)).toBe(name);
    }
  });
});
