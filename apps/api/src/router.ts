import { health } from "./modules/health/router";
import { adminMediaRouter } from "./modules/media/router";
import { adminPostsRouter, postsRouter } from "./modules/posts/router";
import { adminProjectsRouter, projectsRouter } from "./modules/projects/router";
import { adminSettingsRouter, siteRouter } from "./modules/settings/router";
import { adminStatsRouter } from "./modules/stats/router";

// `base.router(...)` requires every procedure in `appContract` to be present,
// and this router grows one module at a time. Each procedure below is still
// fully type-checked against its contract through `base.<path>.handler()`.
// Move to `base.router(...)` once every contract procedure is implemented.
export const appRouter = {
  adminMedia: adminMediaRouter,
  adminPosts: adminPostsRouter,
  adminProjects: adminProjectsRouter,
  adminSettings: adminSettingsRouter,
  adminStats: adminStatsRouter,
  health: { check: health },
  posts: postsRouter,
  projects: projectsRouter,
  site: siteRouter,
};
