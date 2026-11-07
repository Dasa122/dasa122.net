import { describe, expect, test } from "bun:test";
import { githubRepoDetailSchema } from "../domains/github";
import { github } from "./github";

const REPO = {
  defaultBranch: "main",
  description: "Personal site",
  forks: 2,
  htmlUrl: "https://github.com/Dasa122/dasa122.net",
  language: "TypeScript",
  name: "dasa122.net",
  owner: "Dasa122",
  readmeHtml: "<h1>dasa122.net</h1>",
  readmeTruncated: false,
  stars: 12,
  updatedAt: "2026-11-06T12:00:00.000Z",
};

describe("github.repo", () => {
  test("the output schema accepts a representative payload", () => {
    const parsed = githubRepoDetailSchema.safeParse(REPO);
    expect(parsed.success).toBe(true);
    expect(github.repo["~orpc"].route?.path).toBe(
      "/github/repos/{owner}/{name}",
    );
  });

  test("the input rejects an owner containing a slash", () => {
    const input = github.repo["~orpc"].inputSchema;
    if (input === undefined) {
      throw new Error("github.repo must declare an input schema");
    }
    expect(
      input.safeParse({ name: "site", owner: "Dasa122/evil" }).success,
    ).toBe(false);
    expect(input.safeParse({ name: "site", owner: "Dasa122" }).success).toBe(
      true,
    );
  });
});
