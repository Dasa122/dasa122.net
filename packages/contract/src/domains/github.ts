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

/** The GitHub overview page: the repository snapshot, the language counts,
 * the commit total, and the per-day activity for the last 90 days. All of it
 * comes from the cached snapshot — never from a live GitHub call. */
export const githubOverviewSchema = z.object({
  activity: z.array(z.object({ count: z.number().int(), date: z.iso.date() })),
  languages: z.record(z.string(), z.number().int()),
  lastSyncedAt: z.iso.datetime().nullable(),
  repos: z.array(githubRepoSchema),
  totalCommits: z.number().int(),
});
