import { oc } from "@orpc/contract";
import z from "zod";
import {
  githubOverviewSchema,
  githubRepoDetailSchema,
} from "../domains/github";

export const github = {
  overview: oc
    .route({
      description:
        "The GitHub overview, served from the cached snapshot — never a live GitHub call.",
      method: "GET",
      operationId: "getGithubOverview",
      path: "/github/overview",
      tags: ["GitHub"],
    })
    .input(z.object({}))
    .output(githubOverviewSchema),
  repo: oc
    .route({
      description:
        "One repository and its README, fetched live from GitHub and cached briefly.",
      method: "GET",
      operationId: "getGithubRepo",
      path: "/github/repos/{owner}/{name}",
      tags: ["GitHub"],
    })
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[A-Za-z0-9._-]+$/),
        owner: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[A-Za-z0-9._-]+$/),
      }),
    )
    .output(githubRepoDetailSchema),
};
