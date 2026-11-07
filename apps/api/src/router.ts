import { health } from "./modules/health/router";
import { adminPostsRouter, postsRouter } from "./modules/posts/router";

// `base.router(...)` requires every procedure in `appContract` to be present,
// and this router grows one module at a time. Each procedure below is still
// fully type-checked against its contract through `base.<path>.handler()`.
// Move to `base.router(...)` once every contract procedure is implemented.
export const appRouter = {
  adminPosts: adminPostsRouter,
  health: { check: health },
  posts: postsRouter,
};
