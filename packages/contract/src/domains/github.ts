import z from "zod";

/** A public GitHub repository as rendered on the GitHub page. */
export const githubRepoSchema = z.object({
  description: z.string().nullable(),
  featured: z.boolean(),
  forks: z.number().int(),
  language: z.string().nullable(),
  name: z.string(),
  stars: z.number().int(),
  updatedAt: z.iso.datetime(),
  url: z.url(),
});

/** One repository, as the in-site repo page renders it. */
export const githubRepoDetailSchema = z.object({
  defaultBranch: z.string(),
  description: z.string().nullable(),
  forks: z.number().int(),
  htmlUrl: z.url(),
  language: z.string().nullable(),
  name: z.string(),
  owner: z.string(),
  readmeHtml: z.string().nullable(),
  readmeTruncated: z.boolean(),
  stars: z.number().int(),
  updatedAt: z.iso.datetime(),
});

/** One pull request authored by the profile owner, as the GitHub page lists
 * it. `bodyHtml` is already rendered and sanitised by the API. */
export const githubPullSchema = z.object({
  bodyHtml: z.string().nullable(),
  createdAt: z.iso.datetime(),
  merged: z.boolean(),
  number: z.number().int(),
  repo: z.string(),
  state: z.enum(["open", "closed"]),
  title: z.string(),
  updatedAt: z.iso.datetime(),
  url: z.url(),
});

/** The GitHub overview page: the pull requests the page renders, plus the
 * repository snapshot the work and admin surfaces read. All of it comes from
 * the cached snapshot — never from a live GitHub call. */
export const githubOverviewSchema = z.object({
  activity: z.array(z.object({ count: z.number().int(), date: z.iso.date() })),
  languages: z.record(z.string(), z.number().int()),
  lastSyncedAt: z.iso.datetime().nullable(),
  pulls: z.array(githubPullSchema),
  repos: z.array(githubRepoSchema),
});
