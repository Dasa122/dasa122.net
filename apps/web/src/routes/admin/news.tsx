import { buttonClassName } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { AdminHeading } from "../../components/admin-heading";
import { AdminPostRow } from "../../components/admin-post-row";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

/** The admin list's query, shared by the loader and the page. */
export const adminPostListOptions = orpc.adminPosts.list.queryOptions({
  input: { limit: 50 },
});

export const Route = createFileRoute("/admin/news")({
  component: AdminNewsRoute,
  head: () => ({ meta: [{ title: "News — Admin" }] }),
  loader: ({ context }) =>
    context.forbidden
      ? undefined
      : context.queryClient.prefetchQuery(adminPostListOptions),
});

/**
 * `/admin/news` is the parent of the two editor routes, so it renders the list
 * only when the URL is the list itself and hands the rest to the `Outlet`.
 */
function AdminNewsRoute() {
  const matchRoute = useMatchRoute();
  const isList = matchRoute({ fuzzy: false, to: "/admin/news" });

  return isList ? <AdminNewsList /> : <Outlet />;
}

function AdminNewsList() {
  const list = useQuery(adminPostListOptions);
  const queryClient = useQueryClient();
  const remove = useMutation(
    orpc.adminPosts.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.adminPosts.list.key(),
        });
      },
    }),
  );

  const posts = list.data?.items ?? [];

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading
            action={
              <Link className={buttonClassName("solid")} to="/admin/news/new">
                New post
              </Link>
            }
            title="News"
          />

          {list.isPending && (
            <p className="mt-10 font-mono text-[0.75rem] text-muted">
              Loading posts…
            </p>
          )}
          {list.isError && (
            <p className={`mt-10 ${errorText}`}>Could not load posts.</p>
          )}
          {list.isSuccess && posts.length === 0 && (
            <p className={`mt-10 ${muted}`}>No posts yet.</p>
          )}

          {posts.length > 0 && (
            <div className="glass-card mt-8 px-4 sm:px-6">
              <ul className="divide-y divide-[var(--color-rule)]">
                {posts.map((post) => (
                  <li key={post.id}>
                    <AdminPostRow
                      onDelete={() => remove.mutate({ id: post.id })}
                      post={post}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {remove.isError && (
            <p className={`mt-6 ${errorText}`}>Could not delete the post.</p>
          )}
        </div>
      </div>
    </main>
  );
}
