import { buttonClassName, Rule, Section } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { Fragment } from "react";
import { AdminPostRow } from "../../components/admin-post-row";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
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
        <Section>
          <header className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className={eyebrow}>Admin</p>
              <h1 className={`mt-2 ${heading}`}>News</h1>
            </div>
            <Link className={buttonClassName("solid")} to="/admin/news/new">
              New post
            </Link>
          </header>

          <div className="mt-10">
            <Rule />
            {list.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading posts…
              </p>
            )}
            {list.isError && (
              <p className={`py-5 ${errorText}`}>Could not load posts.</p>
            )}
            {list.isSuccess && posts.length === 0 && (
              <p className={`py-5 ${muted}`}>No posts yet.</p>
            )}
            {posts.map((post, index) => (
              <Fragment key={post.id}>
                {index > 0 && <Rule />}
                <AdminPostRow
                  onDelete={() => remove.mutate({ id: post.id })}
                  post={post}
                />
              </Fragment>
            ))}
          </div>

          {remove.isError && (
            <p className={`py-5 ${errorText}`}>Could not delete the post.</p>
          )}
        </Section>
      </div>
    </main>
  );
}
