import { oc } from "@orpc/contract";
import { apiErrors } from "../errors";
import { adminGithub } from "./admin-github";
import { adminLinkedin } from "./admin-linkedin";
import { adminMedia } from "./admin-media";
import { adminPosts } from "./admin-posts";
import { adminProjects } from "./admin-projects";
import { adminSettings } from "./admin-settings";
import { adminStats } from "./admin-stats";
import { github } from "./github";
import { health } from "./health";
import { posts } from "./posts";
import { projects } from "./projects";
import { site } from "./site";

/**
 * The whole dasa122.net API: one procedure per endpoint, implemented by
 * `apps/api/src/router.ts` and consumed by the web app.
 *
 * `oc.errors(apiErrors)` installs the shared error map on every procedure, so
 * each code carries its HTTP status, its default message and its documented
 * error response.
 */
export const appContract = oc.errors(apiErrors).router({
  adminGithub,
  adminLinkedin,
  adminMedia,
  adminPosts,
  adminProjects,
  adminSettings,
  adminStats,
  github,
  health,
  posts,
  projects,
  site,
});
