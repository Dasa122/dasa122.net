import { oc } from "@orpc/contract";
import z from "zod";
import { listResponse } from "../domains/common";
import {
  projectCreateSchema,
  projectSchema,
  projectUpdateSchema,
} from "../domains/projects";

const ADMIN_PROJECTS_TAGS = ["Admin / Projects"];

/** Every `{id}` action takes the id alone as its input. */
const idInputSchema = z.object({ id: z.uuid() });

export const adminProjects = {
  create: oc
    .route({
      description: "Create a project.",
      method: "POST",
      operationId: "postAdminProjects",
      path: "/admin/projects",
      tags: ADMIN_PROJECTS_TAGS,
    })
    .input(projectCreateSchema)
    .output(projectSchema),
  delete: oc
    .route({
      description: "Delete a project.",
      method: "DELETE",
      operationId: "deleteAdminProjectsById",
      path: "/admin/projects/{id}",
      tags: ADMIN_PROJECTS_TAGS,
    })
    .input(idInputSchema)
    .output(z.object({ deleted: z.boolean() })),
  list: oc
    .route({
      description: "List every project, optionally filtered by status.",
      method: "GET",
      operationId: "getAdminProjects",
      path: "/admin/projects",
      tags: ADMIN_PROJECTS_TAGS,
    })
    .input(z.object({ status: z.enum(["draft", "published"]).optional() }))
    .output(listResponse(projectSchema)),
  update: oc
    .route({
      description: "Patch a project.",
      method: "PATCH",
      operationId: "patchAdminProjectsById",
      path: "/admin/projects/{id}",
      tags: ADMIN_PROJECTS_TAGS,
    })
    .input(projectUpdateSchema)
    .output(projectSchema),
};
