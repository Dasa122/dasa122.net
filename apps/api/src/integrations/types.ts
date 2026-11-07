import type { GithubMeta, LinkedinMeta } from "../database/schema";

/** A feed item distilled from an external source, before it is persisted. */
export type PostDraft = {
  body: string | null;
  excerpt: string | null;
  externalId: string;
  externalUrl: string | null;
  githubMeta: GithubMeta | null;
  linkedinMeta: LinkedinMeta | null;
  publishedAt: Date;
  source: "github" | "linkedin";
  tags: string[];
  title: string;
};

/** Everything a feed source needs to fetch one batch. */
export type SyncContext = {
  now: Date;
};

/** The outcome of one sync worker run. */
export type SyncResult = {
  created: number;
  error: string | null;
  skipped: number;
  updated: number;
};

/** An importable feed source. GitHub and LinkedIn both implement it. */
export type FeedSource = {
  readonly source: "github" | "linkedin";
  fetchItems(ctx: SyncContext): Promise<PostDraft[]>;
};
