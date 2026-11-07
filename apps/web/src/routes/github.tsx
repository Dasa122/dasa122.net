import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * The `/github` layout. It renders nothing of its own: the overview page lives
 * in `github.index.tsx` and the repository pages in `github.$owner.$repo.tsx`,
 * so the dotted flat route is a child of this path without inheriting a page.
 */
export const Route = createFileRoute("/github")({
  component: GithubLayout,
});

function GithubLayout() {
  return <Outlet />;
}
