import { afterEach, describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import { getGitHubRepo, repoCacheKey } from "./router";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

type Handler = (url: string, init?: RequestInit) => Response;

/** Replaces global fetch, recording each URL so cache hits are observable. */
function stubFetch(handler: Handler): { calls: string[]; headers: Headers[] } {
  const calls: string[] = [];
  const headers: Headers[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    headers.push(new Headers(init?.headers));
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { calls, headers };
}

const PAYLOAD = {
  default_branch: "main",
  description: "Personal site",
  forks_count: 2,
  html_url: "https://github.com/Dasa122/dasa122.net",
  language: "TypeScript",
  name: "dasa122.net",
  owner: { login: "Dasa122" },
  stargazers_count: 12,
  updated_at: "2026-11-06T12:00:00.000Z",
};

function repoResponse(): Response {
  return new Response(JSON.stringify({ ...PAYLOAD, name: "site" }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function readmeResponse(html: string): Response {
  return new Response(html, {
    headers: { "content-type": "text/html" },
    status: 200,
  });
}

describe("getGitHubRepo", () => {
  test("sanitises the GitHub-rendered README", async () => {
    const fixture =
      '<h1>Hello</h1><script>alert("xss")</script><img src="media/logo.svg"><a href="./docs/x.md">docs</a><img src="https://github.com/o/r/badge.svg">';
    const { headers } = stubFetch((url) =>
      url.endsWith("/readme") ? readmeResponse(fixture) : repoResponse(),
    );

    const repo = await getGitHubRepo("sanitise", "site");

    expect(repo.readmeHtml).not.toContain("<script");
    expect(repo.readmeHtml).not.toContain("alert");
    expect(repo.readmeHtml).toContain("<h1>Hello</h1>");
    expect(repo.readmeHtml).toContain('src="https://github.com/o/r/badge.svg"');
    // GitHub leaves relative URLs relative; the API rewrites them so they do
    // not resolve against this site's route.
    expect(repo.readmeHtml).toContain(
      'src="https://github.com/Dasa122/site/raw/main/media/logo.svg"',
    );
    expect(repo.readmeHtml).toContain(
      'href="https://github.com/Dasa122/site/blob/main/docs/x.md"',
    );
    // The README request negotiates rendered HTML; the metadata call does not.
    const readmeHeaders = headers.at(-1);
    expect(readmeHeaders?.get("Accept")).toBe(
      "application/vnd.github.html+json",
    );
  });

  test("a 404 on the repository maps to NOT_FOUND", async () => {
    stubFetch(() => new Response("not found", { status: 404 }));

    try {
      await getGitHubRepo("missing", "repo");
      throw new Error("expected the call to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
    }
  });

  test("a README failure still returns the repository", async () => {
    stubFetch((url) =>
      url.endsWith("/readme")
        ? new Response("boom", { status: 500 })
        : repoResponse(),
    );

    const repo = await getGitHubRepo("readme-fails", "site");
    expect(repo.readmeHtml).toBeNull();
    expect(repo.readmeTruncated).toBe(false);
    expect(repo.name).toBe("site");
  });

  test("a second call within the TTL is served from the cache", async () => {
    const { calls } = stubFetch((url) =>
      url.endsWith("/readme")
        ? readmeResponse("<p>readme</p>")
        : repoResponse(),
    );

    const first = await getGitHubRepo("cached", "site");
    const afterFirst = calls.length;
    const second = await getGitHubRepo("Cached", "Site");

    expect(afterFirst).toBe(2);
    expect(calls.length).toBe(2);
    expect(second).toEqual(first);
  });

  test("caps an oversized README and flags it as truncated", async () => {
    const html = "<p>line</p>".repeat(40_000);
    stubFetch((url) =>
      url.endsWith("/readme") ? readmeResponse(html) : repoResponse(),
    );

    const repo = await getGitHubRepo("huge-readme", "site");
    expect(repo.readmeTruncated).toBe(true);
    expect(repo.readmeHtml?.length ?? 0).toBeLessThanOrEqual(300_000);
  });
});

describe("repoCacheKey", () => {
  test("is case-insensitive on both parts", () => {
    expect(repoCacheKey("Dasa122", "Dasa122.net")).toBe("dasa122/dasa122.net");
  });
});
