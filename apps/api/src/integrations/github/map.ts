import type { PostDraft } from "../types";
import type { GitHubEvent } from "./client";

/** Narrows an unknown payload field to an object. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The first line of a commit message, trimmed. */
function firstLine(message: string): string {
  return (message.split("\n")[0] ?? "").trim();
}

function repoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

type DraftFields = {
  action: string;
  commitSha?: string | null;
  externalUrl: string;
  title: string;
};

/** Builds the shared PostDraft shape; every GitHub event fills in the rest. */
function draft(event: GitHubEvent, fields: DraftFields): PostDraft {
  return {
    body: null,
    excerpt: null,
    externalId: `${event.repo.name}:${event.id}`,
    externalUrl: fields.externalUrl,
    githubMeta: {
      action: fields.action,
      commitSha: fields.commitSha ?? null,
      language: null,
      repo: event.repo.name,
      stars: null,
      url: fields.externalUrl,
    },
    linkedinMeta: null,
    publishedAt: new Date(event.created_at),
    source: "github",
    tags: [event.repo.name],
    title: fields.title,
  };
}

/** One draft per push: the newest commit subject, or the ref when empty. */
function mapPush(event: GitHubEvent): PostDraft[] {
  const commits = Array.isArray(event.payload.commits)
    ? event.payload.commits
    : [];
  const last = asRecord(commits.at(-1));
  const message = last === null ? null : asString(last.message);
  const subject = message === null ? "" : firstLine(message);
  const ref = asString(event.payload.ref);
  const fallback =
    ref === null || ref === ""
      ? `${event.repo.name} pushed`
      : `${event.repo.name} pushed to ${ref}`;

  return [
    draft(event, {
      action: "push",
      commitSha: last === null ? null : asString(last.sha),
      externalUrl: repoUrl(event.repo.name),
      title: subject === "" ? fallback : subject,
    }),
  ];
}

function mapPullRequest(event: GitHubEvent): PostDraft[] {
  const action = asString(event.payload.action);
  if (action !== "opened" && action !== "closed") {
    return [];
  }
  const pullRequest = asRecord(event.payload.pull_request);
  if (pullRequest === null) {
    return [];
  }
  // A closed but unmerged pull request is not news.
  if (action === "closed" && pullRequest.merged !== true) {
    return [];
  }

  return [
    draft(event, {
      action:
        action === "opened" ? "pull_request_opened" : "pull_request_merged",
      externalUrl: asString(pullRequest.html_url) ?? repoUrl(event.repo.name),
      title: asString(pullRequest.title) ?? "",
    }),
  ];
}

function mapRelease(event: GitHubEvent): PostDraft[] {
  if (asString(event.payload.action) !== "published") {
    return [];
  }
  const release = asRecord(event.payload.release);
  if (release === null) {
    return [];
  }
  const name = asString(release.name);
  const tag = asString(release.tag_name);

  return [
    draft(event, {
      action: "release_published",
      externalUrl: asString(release.html_url) ?? repoUrl(event.repo.name),
      title: name !== null && name !== "" ? name : (tag ?? ""),
    }),
  ];
}

function mapIssue(event: GitHubEvent): PostDraft[] {
  const action = asString(event.payload.action);
  if (action !== "opened" && action !== "closed") {
    return [];
  }
  const issue = asRecord(event.payload.issue);
  if (issue === null) {
    return [];
  }

  return [
    draft(event, {
      action: `issue_${action}`,
      externalUrl: asString(issue.html_url) ?? repoUrl(event.repo.name),
      title: asString(issue.title) ?? "",
    }),
  ];
}

function mapIssueComment(event: GitHubEvent): PostDraft[] {
  if (asString(event.payload.action) !== "created") {
    return [];
  }
  const issue = asRecord(event.payload.issue);
  if (issue === null) {
    return [];
  }
  const number = asNumber(issue.number);
  const title = asString(issue.title) ?? "";
  const heading =
    number === null ? `Comment on ${title}` : `Comment on #${number} ${title}`;

  return [
    draft(event, {
      action: "issue_comment",
      externalUrl: asString(issue.html_url) ?? repoUrl(event.repo.name),
      title: heading,
    }),
  ];
}

/**
 * Distills one GitHub event into zero or more feed drafts. Pure: it reads the
 * event and nothing else, so it can be tested without a network or a database.
 * `CreateEvent` and every unhandled type are noise and produce nothing.
 */
export function mapGitHubEvent(event: GitHubEvent): PostDraft[] {
  switch (event.type) {
    case "IssueCommentEvent":
      return mapIssueComment(event);
    case "IssuesEvent":
      return mapIssue(event);
    case "PullRequestEvent":
      return mapPullRequest(event);
    case "PushEvent":
      return mapPush(event);
    case "ReleaseEvent":
      return mapRelease(event);
    default:
      return [];
  }
}
