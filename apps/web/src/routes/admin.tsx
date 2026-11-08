import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminHeading } from "../components/admin-heading";
import { AdminNav } from "../components/admin-nav";
import { adminStatsOptions } from "../utils/admin-stats";
import { adminRedirectTarget, classifyAdminError } from "./admin/admin-guard";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";

/**
 * The layout for every `/admin` route. It is not a page: the dashboard and the
 * admin panels render through the `Outlet`, and the gate below runs before any
 * of them.
 *
 * An anonymous visitor is sent to the Authentik login with a return path. A
 * signed-in visitor who is not in the admin group is *not* redirected — a
 * login round trip cannot grant them the group — so the layout renders the
 * not-in-group message instead.
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context, location }) => {
    try {
      // `fetchQuery` refetches unconditionally, so the gate never trusts a
      // cached admin result (e.g. data left by a previous admin session).
      await context.queryClient.fetchQuery({
        ...adminStatsOptions,
        retry: false,
        staleTime: 0,
      });
      return { forbidden: false };
    } catch (error) {
      const kind = classifyAdminError(error);
      if (kind === "forbidden") {
        return { forbidden: true };
      }
      if (kind === "unauthorized") {
        // `href` + `reloadDocument` makes this a full-document navigation to
        // the API route rather than a router navigation to a page that does
        // not exist in the route tree.
        throw redirect({
          href: adminRedirectTarget(location.pathname),
          reloadDocument: true,
        });
      }
      throw error;
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { forbidden } = Route.useRouteContext();

  if (forbidden) {
    return (
      <main className="flex-1">
        <div className={frame}>
          <div className="py-[clamp(3rem,8vw,6rem)]">
            <AdminHeading title="Admin" />
            <div className="glass-card mt-10 p-6 sm:p-8">
              <p className="text-lg leading-relaxed text-ink">
                Your account is not in the admin group.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className={frame}>
        <AdminNav />
      </div>
      <Outlet />
    </>
  );
}
