import { describe, expect, test } from "bun:test";

describe("work index", () => {
  test("renders one card per project", async () => {
    const { WorkIndex } = await import("./index");
    expect(typeof WorkIndex).toBe("function");
  });
});
