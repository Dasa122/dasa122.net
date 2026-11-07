import { oc } from "@orpc/contract";
import z from "zod";
import { githubOverviewSchema } from "../domains/github";

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
};
