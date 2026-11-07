import { describe, expect, test } from "bun:test";
import { mapGitHubEvent } from "./map";

const base = {
  actor: { login: "Dasa122" },
  created_at: "2026-11-06T12:00:00Z",
  id: "1001",
  repo: { name: "Dasa122/dasa122.net" },
};

describe("mapGitHubEvent", () => {
  test("a push event yields exactly one draft whose title is the latest commit subject", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: {
        commits: [
          { message: "first commit", sha: "aaa" },
          { message: "Ship the news feed\n\nlong body", sha: "bbb" },
        ],
        ref: "refs/heads/main",
      },
      type: "PushEvent",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe("Ship the news feed");
    expect(drafts[0]?.externalId).toBe("Dasa122/dasa122.net:1001");
    expect(drafts[0]?.githubMeta?.commitSha).toBe("bbb");
    expect(drafts[0]?.publishedAt.toISOString()).toBe(
      "2026-11-06T12:00:00.000Z",
    );
  });

  test("a push event with no commits falls back to the repo and ref", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: { commits: [], ref: "refs/heads/main" },
      type: "PushEvent",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe(
      "Dasa122/dasa122.net pushed to refs/heads/main",
    );
    expect(drafts[0]?.githubMeta?.commitSha).toBeNull();
  });

  test("a pull request opened yields one draft, but a labeled one yields none", () => {
    const opened = mapGitHubEvent({
      ...base,
      payload: {
        action: "opened",
        pull_request: {
          html_url: "https://github.com/x/y/pull/7",
          merged: false,
          number: 7,
          title: "Add feed",
        },
      },
      type: "PullRequestEvent",
    });
    expect(opened).toHaveLength(1);
    expect(opened[0]?.title).toBe("Add feed");

    const labeled = mapGitHubEvent({
      ...base,
      payload: {
        action: "labeled",
        pull_request: {
          html_url: "https://github.com/x/y/pull/7",
          merged: false,
          number: 7,
          title: "Add feed",
        },
      },
      type: "PullRequestEvent",
    });
    expect(labeled).toHaveLength(0);
  });

  test("a merged pull request yields a merged draft", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: {
        action: "closed",
        pull_request: {
          html_url: "https://github.com/x/y/pull/7",
          merged: true,
          number: 7,
          title: "Add feed",
        },
      },
      type: "PullRequestEvent",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.githubMeta?.action).toBe("pull_request_merged");
  });

  test("a closed but unmerged pull request yields nothing", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: {
        action: "closed",
        pull_request: {
          html_url: "https://github.com/x/y/pull/7",
          merged: false,
          number: 7,
          title: "Add feed",
        },
      },
      type: "PullRequestEvent",
    });
    expect(drafts).toHaveLength(0);
  });

  test("a CreateEvent yields no drafts", () => {
    expect(
      mapGitHubEvent({
        ...base,
        payload: { ref: "refs/heads/x", ref_type: "branch" },
        type: "CreateEvent",
      }),
    ).toHaveLength(0);
  });

  test("a published release yields one draft", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: {
        action: "published",
        release: {
          html_url: "https://github.com/x/y/releases/tag/v1.0.0",
          name: "v1.0.0",
          tag_name: "v1.0.0",
        },
      },
      type: "ReleaseEvent",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe("v1.0.0");
  });

  test("an issues event yields one draft for a relevant action", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: {
        action: "opened",
        issue: { html_url: "https://github.com/x/y/issues/3", title: "Bug" },
      },
      type: "IssuesEvent",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.githubMeta?.action).toBe("issue_opened");
  });

  test("an issue comment yields one draft", () => {
    const drafts = mapGitHubEvent({
      ...base,
      payload: {
        action: "created",
        issue: {
          html_url: "https://github.com/x/y/issues/3",
          number: 3,
          title: "Bug",
        },
      },
      type: "IssueCommentEvent",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe("Comment on #3 Bug");
    expect(drafts[0]?.githubMeta?.action).toBe("issue_comment");
  });

  test("an unknown event type yields no drafts", () => {
    expect(
      mapGitHubEvent({ ...base, payload: {}, type: "WatchEvent" }),
    ).toHaveLength(0);
  });
});
