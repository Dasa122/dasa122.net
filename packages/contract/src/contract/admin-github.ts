import { oc } from "@orpc/contract";
import z from "zod";
import {
  adminGithubStatusSchema,
  adminSyncResponseSchema,
} from "../domains/admin";

const ADMIN_GITHUB_TAGS = ["Admin / GitHub"];

export const adminGithub = {
  featuredRepos: oc
    .route({
      description:
        "Replace the featured repository set with the full new list of names.",
      method: "PATCH",
      operationId: "patchAdminGithubFeatured",
      path: "/admin/github/featured",
      tags: ADMIN_GITHUB_TAGS,
    })
    .input(z.object({ repos: z.array(z.string()) }))
    .output(z.object({ repos: z.array(z.string()) })),
  status: oc
    .route({
      description:
        "The GitHub admin panel state, read from the cached snapshot — never a live GitHub call.",
      method: "GET",
      operationId: "getAdminGithub",
      path: "/admin/github",
      tags: ADMIN_GITHUB_TAGS,
    })
    .input(z.object({}))
    .output(adminGithubStatusSchema),
  sync: oc
    .route({
      description: "Run the GitHub sync worker once.",
      method: "POST",
      operationId: "postAdminGithubSync",
      path: "/admin/github/sync",
      tags: ADMIN_GITHUB_TAGS,
    })
    .input(z.object({}))
    .output(adminSyncResponseSchema),
};
