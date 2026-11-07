import { buttonClassName, Rule, Section } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { Marquee } from "../components/marquee";
import { PostRow } from "../components/post-row";
import { ProjectRow } from "../components/project-row";
import { SectionHeading, SectionKicker } from "../components/section-heading";
import { useCountUp } from "../hooks/use-count-up";
import { useReveal } from "../hooks/use-reveal";
import { canonicalOrigin } from "../utils/canonical";
import { orpc } from "../utils/orpc";

const POSTS_LIMIT = 10;
const TITLE = "Dasa122 — notes on building software";
const DESCRIPTION =
  "Dasa122 builds careful software for the web: notes on interfaces, APIs, and the systems between them.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";

// The band between the hero and the work: what the site is built with.
const STACK = [
  "TYPESCRIPT",
  "REACT",
  "BUN",
  "POSTGRESQL",
  "TANSTACK",
  "ORPC",
  "TAILWIND",
  "DOCKER",
  "CLOUDFLARE",
];

// One options object per query, shared by the loader's prefetch and the
// component's `useQuery` so the server render is never fetched twice.
const postsOptions = orpc.posts.list.queryOptions({
  input: { limit: POSTS_LIMIT },
});
const projectsOptions = orpc.projects.list.queryOptions({ input: {} });

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
      context.queryClient.prefetchQuery(postsOptions),
      context.queryClient.prefetchQuery(projectsOptions),
    ]);
  },
});

function HomePage() {
  const posts = useQuery(postsOptions);
  const projects = useQuery(projectsOptions);
  const featured = (projects.data?.items ?? []).filter(
    (project) => project.featured,
  );

  const hero = useReveal<HTMLDivElement>(0);
  const work = useReveal<HTMLDivElement>(1);
  const notes = useReveal<HTMLDivElement>(2);

  const postsCount = useCountUp(posts.data?.total);
  const projectsCount = useCountUp(projects.data?.total);

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="relative isolate overflow-hidden" ref={hero}>
          <div
            aria-hidden="true"
            className="hero-glow pointer-events-none absolute inset-0 -z-10"
          />
          <header className="grid grid-cols-12 gap-x-6 pt-[clamp(3.5rem,9vw,7rem)]">
            <div className="col-span-12 md:col-span-7">
              <h1 className="hero-wipe font-display text-[clamp(4.5rem,14vw,11rem)] leading-[0.82] tracking-[-0.04em]">
                Dasa122
              </h1>
              <div
                aria-hidden="true"
                className="draw-in mt-6 h-[2px] w-20 bg-ember"
              />
            </div>
            <div className="col-span-12 mt-10 self-end md:col-span-4 md:col-start-9 md:mt-0">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
                Currently
              </p>
              <p className="mt-3 text-[1.0625rem] leading-relaxed">
                Builds careful software for the web — interfaces, APIs, and the
                systems between them.
              </p>
              <p className="mt-6 flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted">
                <span aria-hidden="true" className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-source-github opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-source-github" />
                </span>
                Building in public
              </p>
              <p className="mt-6 flex items-center gap-3 font-mono text-[0.75rem] tabular-nums text-muted">
                <span title={posts.isError ? "unavailable" : undefined}>
                  <span className="tabular-nums" ref={postsCount.ref}>
                    {postsCount.value ?? "—"}
                  </span>{" "}
                  posts
                </span>
                <span aria-hidden="true" className="h-3 w-px bg-rule" />
                <span title={projects.isError ? "unavailable" : undefined}>
                  <span className="tabular-nums" ref={projectsCount.ref}>
                    {projectsCount.value ?? "—"}
                  </span>{" "}
                  projects
                </span>
              </p>
            </div>
          </header>
        </div>
      </div>

      {/* Full-bleed between the hero and the work. The band's own top border
          is the divider, so the hero no longer ends with its own rule. */}
      <div className="mt-16 md:mt-24">
        <Marquee items={STACK} />
      </div>

      <div className={frame}>
        {projects.isError && (
          <p className="pt-8 font-mono text-[0.75rem] text-ember-text">
            Could not load the featured work.
          </p>
        )}

        {featured.length > 0 && (
          <div ref={work}>
            <Section>
              <SectionKicker>Work</SectionKicker>
              <SectionHeading title="Selected work" />
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
          </div>
        )}

        <div ref={notes}>
          <Section>
            <SectionKicker>Journal</SectionKicker>
            <SectionHeading
              action={
                <Link className={buttonClassName("quiet")} to="/news">
                  All notes
                </Link>
              }
              title="Notes"
            />

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
      </div>
    </main>
  );
}
