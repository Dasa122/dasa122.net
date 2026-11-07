import { ORPCError } from "@orpc/server";
import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import {
  adminCreateProject,
  adminDeleteProject,
  adminListProjects,
  adminUpdateProject,
  getPublishedProjectBySlug,
  listPublishedProjects,
} from "./repository";

export const projectsRouter = {
  bySlug: base.projects.bySlug.handler(async ({ input }) => {
    const project = await getPublishedProjectBySlug(input.slug);
    if (project === null) {
      throw new ORPCError("NOT_FOUND", { message: "Project not found" });
    }
    return project;
  }),
  list: base.projects.list.handler(async () => {
    const items = await listPublishedProjects();
    return { items, total: items.length };
  }),
};

export const adminProjectsRouter = {
  create: base.adminProjects.create.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminCreateProject(input);
  }),
  delete: base.adminProjects.delete.handler(async ({ context, input }) => {
    await requireAdmin(context);
    await adminDeleteProject(input.id);
    return { deleted: true };
  }),
  list: base.adminProjects.list.handler(async ({ context, input }) => {
    await requireAdmin(context);
    const items = await adminListProjects(input);
    return { items, total: items.length };
  }),
  update: base.adminProjects.update.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return adminUpdateProject(input.id, input);
  }),
};
