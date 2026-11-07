import { Button, Rule, Section } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { PostRow } from "../components/post-row";
import { ProjectRow } from "../components/project-row";
import { canonicalOrigin } from "../utils/canonical";
import { orpc } from "../utils/orpc";

const POSTS_LIMIT = 10;
const TITLE = "Dasa122 — notes on building software";
const DESCRIPTION =
  "Dasa122 builds careful software for the web: notes on interfaces, APIs, and the systems between them.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => {
    const canonical = `${canonicalOrigin()}/`;
    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title: TITLE },
        { content: DESCRIPTION, name: "description" },
        { content: TITLE, property: "og:title" },
        { content: DESCRIPTION, property: "og:description" },
        { content: canonical, property: "og:url" },
        { content: "website", property: "og:type" },
      ],
    };
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(
        orpc.posts.list.queryOptions({ input: { limit: POSTS_LIMIT } }),
      ),
      context.queryClient.prefetchQuery(
        orpc.projects.list.queryOptions({ input: {} }),
      ),
    ]);
  },
});

function HomePage() {
  const posts = useQuery(
    orpc.posts.list.queryOptions({ input: { limit: POSTS_LIMIT } }),
  );
  const projects = useQuery(orpc.projects.list.queryOptions({ input: {} }));
  const featured = (projects.data?.items ?? []).filter(
    (project) => project.featured,
  );

  return (
    <main className="flex-1">
      <div className={frame}>
        <header className="rise pt-[clamp(3.5rem,9vw,7rem)]">
          <h1 className="font-display text-[clamp(4.5rem,17vw,13rem)] leading-[0.82] tracking-[-0.035em]">
            Dasa122
          </h1>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-ink md:mt-8 md:text-xl">
            Builds careful software for the web — interfaces, APIs, and the
            systems between them.
          </p>
        </header>

        {projects.isError && (
          <p className="pt-8 font-mono text-[0.75rem] text-ember-text">
            Could not load the featured work.
          </p>
        )}

        {featured.length > 0 && (
          <Section>
            <h2 className={heading}>Selected work</h2>
            <div className="mt-6">
              <Rule />
              {featured.map((project, index) => (
                <Fragment key={project.id}>
                  {index > 0 && <Rule />}
                  <ProjectRow project={project} />
                </Fragment>
              ))}
            </div>
          </Section>
        )}

        <Section>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className={heading}>Notes</h2>
            <Button href="/news" variant="quiet">
              All notes
            </Button>
          </div>

          <div className="mt-6">
            <Rule />
            {posts.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading notes…
              </p>
            )}
            {posts.isError && (
              <p className="py-5 font-mono text-[0.75rem] text-ember-text">
                Could not load the feed.
              </p>
            )}
            {posts.data?.items.length === 0 && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Nothing published yet.
              </p>
            )}
            {posts.data?.items.map((post, index) => (
              <Fragment key={post.id}>
                {index > 0 && <Rule />}
                <PostRow post={post} />
              </Fragment>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
