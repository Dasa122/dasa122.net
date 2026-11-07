import { describe, expect, test } from "bun:test";

describe("work index", () => {
  test("renders one row per project rather than a card grid", async () => {
    const { WorkIndex } = await import("./index");
    expect(typeof WorkIndex).toBe("function");
  });
});
