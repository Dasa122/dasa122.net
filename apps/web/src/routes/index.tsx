import { buttonClassName, Rule } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { Marquee } from "../components/marquee";
import { PostCard } from "../components/post-card";
import { PostRow } from "../components/post-row";
import { ProjectCard } from "../components/project-card";
import { SectionKicker } from "../components/section-heading";
import { useCountUp } from "../hooks/use-count-up";
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
  // The home page is a journal of things I wrote, not a feed of imported
  // GitHub events; `/news` still lists every source.
  input: { limit: POSTS_LIMIT, sources: ["own", "linkedin"] },
});
const projectsOptions = orpc.projects.list.queryOptions({ input: {} });
// The root loader has already cached this, so reading it here is free.
const siteOptions = orpc.site.get.queryOptions({ input: {} });

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

/** The mono label over every band. */
function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
      {children}
    </p>
  );
}

function HomePage() {
  const posts = useQuery(postsOptions);
  const projects = useQuery(projectsOptions);
  const site = useQuery(siteOptions);

  const items = posts.data?.items ?? [];
  const featured = (projects.data?.items ?? []).filter(
    (project) => project.featured,
  );

  // The first three notes are cards, the rest is the list.
  const cards = items.slice(0, 3);
  const rest = items.slice(3);

  const postsCount = useCountUp(posts.data?.total);
  const projectsCount = useCountUp(projects.data?.total);
  // A missing or errored site query leaves this undefined: the band then
  // falls back to two columns rather than claiming zero sources.
  const sourceTotal = site.data?.enabledSources.length;
  const sourcesCount = useCountUp(sourceTotal);
  const statsColumns =
    sourceTotal !== undefined && sourceTotal > 0
      ? "sm:grid-cols-3"
      : "sm:grid-cols-2";

  return (
    <main className="flex-1">
      {/* ---------------------------------------------------------------- */}
      {/* Hero: one screen, the headline, two ways in, and the colour field. */}
      {/* ---------------------------------------------------------------- */}
      <section className="hero-stage relative isolate flex min-h-[calc(100dvh-4.25rem)] items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="hero-glow hero-parallax pointer-events-none absolute inset-0 -z-10"
        />
        <div className={`${frame} relative py-20`}>
          <Eyebrow>Notes · Projects · GitHub</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-display text-[clamp(2.75rem,8.5vw,7.5rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
            Software, built <span className="gradient-word">carefully</span>.
          </h1>

          <p className="mt-8 max-w-[44ch] text-lg leading-relaxed text-muted md:text-xl">
            Notes on interfaces, APIs, and the systems between them — written
            while building them.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link className={buttonClassName("solid")} to="/news">
              Read the notes
            </Link>
            <Link className={buttonClassName("quiet")} to="/work">
              See the work
            </Link>
          </div>

          <p className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-source-github opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-source-github" />
              </span>
              Building in public
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-rule" />
            <span className="tabular-nums">
              {posts.data?.total ?? "—"} posts
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-rule" />
            <span className="tabular-nums">
              {projects.data?.total ?? "—"} projects
            </span>
          </p>
        </div>
      </section>

      {/* The stack ticker, full-bleed, between the hero and the work. */}
      <Marquee items={STACK} />

      {/* ---------------------------------------------------------------- */}
      {/* Work: a pinned horizontal rail on wide, motion-friendly screens;  */}
      {/* a plain card grid everywhere else (see `.rail` in app.css).       */}
      {/* ---------------------------------------------------------------- */}
      {projects.isError && (
        <p className={`${frame} pt-8 font-mono text-[0.75rem] text-ember-text`}>
          Could not load the featured work.
        </p>
      )}

      {featured.length > 0 && (
        <section aria-labelledby="work-title" className="rail">
          <div className="rail-viewport">
            <div className={`${frame} flex items-end justify-between gap-6`}>
              <div>
                <SectionKicker>Work</SectionKicker>
                <h2
                  className="font-display text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.045em]"
                  id="work-title"
                >
                  Selected work
                </h2>
              </div>
              <Link
                className="hidden shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-300 hover:text-ember-text sm:block"
                to="/work"
              >
                All work ↗
              </Link>
            </div>

            <div className="rail-track">
              {featured.map((project, index) => (
                <ProjectCard index={index} key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Journal: the three newest notes as cards, the rest as rows.        */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${frame} py-[clamp(4rem,10vw,8rem)]`}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <SectionKicker>Journal</SectionKicker>
            <h2 className="font-display text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
              Notes
            </h2>
          </div>
          <Link
            className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-300 hover:text-ember-text"
            to="/news"
          >
            All notes ↗
          </Link>
        </div>

        {posts.isPending && (
          <p className="mt-10 font-mono text-[0.75rem] text-muted">
            Loading notes…
          </p>
        )}
        {posts.isError && (
          <p className="mt-10 font-mono text-[0.75rem] text-ember-text">
            Could not load the feed.
          </p>
        )}
        {posts.data?.items.length === 0 && (
          <p className="mt-10 font-mono text-[0.75rem] text-muted">
            Nothing published yet.
          </p>
        )}

        {cards.length > 0 && (
          <div className="reveal mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {cards.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-10">
            <Rule />
            {rest.map((post, index) => (
              <Fragment key={post.id}>
                {index > 0 && <Rule />}
                <PostRow post={post} />
              </Fragment>
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The band: the three totals the page actually knows.                */}
      {/* ---------------------------------------------------------------- */}
      <section aria-label="At a glance" className="stats-band">
        <div
          className={`${frame} grid gap-10 py-[clamp(3rem,7vw,5rem)] ${statsColumns}`}
        >
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
              Published
            </p>
            <p className="mt-3 font-display text-[clamp(3.5rem,9vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.05em] tabular-nums">
              <span ref={postsCount.ref}>
                {postsCount.value ?? posts.data?.total ?? "—"}
              </span>
            </p>
            <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
              posts
            </p>
          </div>

          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
              Shipped
            </p>
            <p className="mt-3 font-display text-[clamp(3.5rem,9vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.05em] tabular-nums">
              <span ref={projectsCount.ref}>
                {projectsCount.value ?? projects.data?.total ?? "—"}
              </span>
            </p>
            <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
              projects
            </p>
          </div>

          {sourceTotal !== undefined && sourceTotal > 0 && (
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
                Connected
              </p>
              <p className="mt-3 font-display text-[clamp(3.5rem,9vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.05em] tabular-nums">
                <span ref={sourcesCount.ref}>
                  {sourcesCount.value ?? sourceTotal}
                </span>
              </p>
              <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
                sources
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing statement.                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className={`${frame} py-[clamp(5rem,12vw,9rem)]`}>
        <h2 className="max-w-[20ch] font-display text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.045em]">
          The web is better when it is{" "}
          <span className="gradient-word">built carefully</span>.
        </h2>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link className={buttonClassName("solid")} to="/news">
            Read the notes
          </Link>
          <Link className={buttonClassName("quiet")} to="/about">
            About Dasa122
          </Link>
        </div>
      </section>
    </main>
  );
}
