import { describe, expect, test } from "bun:test";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  test("lowercases and joins words with a dash", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("collapses punctuation runs into a single dash", () => {
    expect(slugify("Hello,  World!!")).toBe("hello-world");
  });

  test("strips leading and trailing dashes", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
  });

  test("returns an empty string when there are no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });

  test("truncates to 80 characters", () => {
    expect(slugify("a".repeat(200)).length).toBe(80);
  });
});

describe("uniqueSlug", () => {
  test("returns the base when it is free", async () => {
    expect(await uniqueSlug("hello", async () => false)).toBe("hello");
  });

  test("appends a counter until the candidate is free", async () => {
    const taken = new Set(["hello", "hello-2", "hello-3"]);
    expect(
      await uniqueSlug("hello", async (candidate) => taken.has(candidate)),
    ).toBe("hello-4");
  });

  test("passes every candidate to the existence check", async () => {
    const seen: string[] = [];
    await uniqueSlug("a", async (candidate) => {
      seen.push(candidate);
      return seen.length < 2;
    });
    expect(seen).toEqual(["a", "a-2"]);
  });
});
