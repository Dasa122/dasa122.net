import { Rule, Section } from "@dasa122/ui";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminNav } from "../components/admin-nav";
import { adminStatsOptions } from "../utils/admin-stats";
import { adminRedirectTarget } from "./admin/admin-guard";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";

function isForbidden(error: unknown): boolean {
  return hasCode(error, "FORBIDDEN");
}

function isUnauthorized(error: unknown): boolean {
  return hasCode(error, "UNAUTHORIZED");
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

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
      await context.queryClient.ensureQueryData({
        ...adminStatsOptions,
        retry: false,
      });
      return { forbidden: false };
    } catch (error) {
      if (isForbidden(error)) {
        return { forbidden: true };
      }
      if (isUnauthorized(error)) {
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
          <Section>
            <h1 className={heading}>Admin</h1>
            <div className="mt-8">
              <Rule />
            </div>
            <p className="py-6 text-lg leading-relaxed text-ink">
              Your account is not in the admin group.
            </p>
          </Section>
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
