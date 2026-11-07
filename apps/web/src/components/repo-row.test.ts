import { describe, expect, test } from "bun:test";
import { parseRepoUrl } from "./repo-row";

describe("parseRepoUrl", () => {
  test("splits a normal repository URL", () => {
    expect(parseRepoUrl("https://github.com/Dasa122/dasa122.net")).toEqual({
      name: "dasa122.net",
      owner: "Dasa122",
    });
  });

  test("ignores a trailing slash", () => {
    expect(parseRepoUrl("https://github.com/Dasa122/dasa122.net/")).toEqual({
      name: "dasa122.net",
      owner: "Dasa122",
    });
  });

  test("drops a .git suffix", () => {
    expect(parseRepoUrl("https://github.com/Dasa122/dasa122.net.git")).toEqual({
      name: "dasa122.net",
      owner: "Dasa122",
    });
  });

  test("returns null for a non-GitHub URL", () => {
    expect(parseRepoUrl("https://gitlab.com/Dasa122/dasa122.net")).toBeNull();
  });

  test("returns null for a GitHub URL that is not a repository", () => {
    expect(parseRepoUrl("https://github.com/Dasa122")).toBeNull();
  });
});
