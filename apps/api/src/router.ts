import { adminGithubRouter, githubRouter } from "./integrations/github/router";
import { adminLinkedinRouter } from "./integrations/linkedin/router";
import { health } from "./modules/health/router";
import { adminMediaRouter } from "./modules/media/router";
import { adminPostsRouter, postsRouter } from "./modules/posts/router";
import { adminProjectsRouter, projectsRouter } from "./modules/projects/router";
import { adminSettingsRouter, siteRouter } from "./modules/settings/router";
import { adminStatsRouter } from "./modules/stats/router";
import { base } from "./orpc";

// `base.router(...)` requires every procedure in `appContract` to be present.
// Every contract router is registered here, so this is also the whole-contract
// completeness check: a procedure in the contract but missing below fails the
// type-check.
export const appRouter = base.router({
  adminGithub: adminGithubRouter,
  adminLinkedin: adminLinkedinRouter,
  adminMedia: adminMediaRouter,
  adminPosts: adminPostsRouter,
  adminProjects: adminProjectsRouter,
  adminSettings: adminSettingsRouter,
  adminStats: adminStatsRouter,
  github: githubRouter,
  health: { check: health },
  posts: postsRouter,
  projects: projectsRouter,
  site: siteRouter,
});
