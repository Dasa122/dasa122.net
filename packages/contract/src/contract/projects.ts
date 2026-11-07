import { oc } from "@orpc/contract";
import z from "zod";
import { listResponse } from "../domains/common";
import { projectBySlugSchema, projectSchema } from "../domains/projects";

const PROJECTS_TAGS = ["Projects"];

export const projects = {
  bySlug: oc
    .route({
      description: "Fetch one published project by slug.",
      method: "GET",
      operationId: "getProjectsBySlug",
      path: "/projects/{slug}",
      tags: PROJECTS_TAGS,
    })
    .input(projectBySlugSchema)
    .output(projectSchema),
  list: oc
    .route({
      description: "List published projects in display order.",
      method: "GET",
      operationId: "getProjects",
      path: "/projects",
      tags: PROJECTS_TAGS,
    })
    .input(z.object({}))
    .output(listResponse(projectSchema)),
};
