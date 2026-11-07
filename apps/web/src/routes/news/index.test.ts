import { describe, expect, test } from "bun:test";
import { SOURCES } from "./index";

describe("news source filters", () => {
  test("offers every post source", () => {
    expect(SOURCES.map((s) => s.value)).toEqual(["own", "github", "linkedin"]);
  });

  test("labels each source for the reader", () => {
    expect(SOURCES.find((s) => s.value === "own")?.label).toBe("Notes");
    expect(SOURCES.find((s) => s.value === "github")?.label).toBe("GitHub");
    expect(SOURCES.find((s) => s.value === "linkedin")?.label).toBe("LinkedIn");
  });
});
