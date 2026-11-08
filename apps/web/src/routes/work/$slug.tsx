import { buttonClassName, Tag } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { coverForSlug } from "../../components/project-card";
import { absoluteUrl, canonicalOrigin } from "../../utils/canonical";
import { isNotFound } from "../../utils/errors";
import { type api, orpc } from "../../utils/orpc";

type ProjectDetail = Awaited<ReturnType<typeof api.projects.bySlug>>;

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const kicker =
  "font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted";
const railLink =
  "group flex flex-col gap-0.5 font-mono text-[0.75rem] text-ink";
const railLabel =
  "inline-flex items-center gap-1 transition-colors duration-300 ease-[var(--ease-out)] group-hover:text-ember-text";

/** The host of an outbound link, as the rail labels it. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const Route = createFileRoute("/work/$slug")({
  component: ProjectPage,
  head: ({ loaderData, params }) => {
    // The router does not infer the loader's return type here, so the runtime
    // data (always the loader's `ProjectDetail`) is re-typed for `head`.
    const project = loaderData as ProjectDetail | undefined;
    if (!project) {
      return { meta: [{ title: "Project not found — Dasa122" }] };
    }
    const url = `${canonicalOrigin()}/work/${params.slug}`;
    return {
      links: [{ href: url, rel: "canonical" }],
      meta: [
        { title: project.title },
        { content: project.summary, name: "description" },
        { content: project.title, property: "og:title" },
        { content: project.summary, property: "og:description" },
        { content: "article", property: "og:type" },
        { content: url, property: "og:url" },
        ...(project.coverImage
          ? [{ content: absoluteUrl(project.coverImage), property: "og:image" }]
          : []),
      ],
    };
  },
  loader: async ({ context, params }): Promise<ProjectDetail> => {
    try {
      return await context.queryClient.ensureQueryData(
        orpc.projects.bySlug.queryOptions({
          input: { slug: params.slug },
          retry: (failureCount, error) =>
            !isNotFound(error) && failureCount < 3,
        }),
      );
    } catch (error) {
      if (isNotFound(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  notFoundComponent: ProjectNotFound,
});

/**
 * The project page shows the summary, the stack, and the outbound links.
 * `projectSchema.body` is raw markdown and the API returns no rendered HTML for
 * projects, so the body is deliberately not rendered: piping markdown into
 * `Prose` (which expects sanitised HTML) would be wrong, and printing the
 * markdown source as text would read as syntax rather than prose.
 */
function ProjectPage() {
  const { slug } = Route.useParams();
  const { data: project } = useQuery(
    orpc.projects.bySlug.queryOptions({ input: { slug } }),
  );
  if (!project) {
    return null;
  }

  const hasRail =
    project.stack.length > 0 ||
    project.repoUrl !== null ||
    project.liveUrl !== null;

  return (
    <main className="flex-1">
      {/* The hero is the project's own colour, chosen from the same five covers
          the cards use — hashed from the slug, so it never changes under the
          project. The title sits in the scrim at the bottom, where white clears
          the contrast bar over every one of the five. */}
      <section
        className="relative isolate overflow-hidden"
        style={{ backgroundImage: coverForSlug(project.slug) }}
      >
        <div aria-hidden="true" className="cover-scrim absolute inset-0" />
        <div
          className={`${frame} relative flex min-h-[clamp(16rem,38vh,24rem)] flex-col justify-end pt-24 pb-[clamp(2rem,5vw,3.5rem)]`}
        >
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-white">
            Project
          </p>
          <h1 className="mt-4 max-w-[20ch] font-display text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-white [overflow-wrap:anywhere]">
            {project.title}
          </h1>
        </div>
      </section>

      <div className={frame}>
        <div className="grid gap-12 py-[clamp(3rem,7vw,5rem)] lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-16">
          <div className="min-w-0">
            {/* The summary is the lead paragraph: it is the only prose the API
                has for a project, so it carries the page. */}
            <p className="max-w-[62ch] text-lg leading-relaxed text-ink md:text-xl">
              {project.summary}
            </p>

            {project.repoUrl || project.liveUrl ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {project.repoUrl && (
                  <a
                    className={buttonClassName("solid")}
                    href={project.repoUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Repository ↗
                  </a>
                )}
                {project.liveUrl && (
                  <a
                    className={buttonClassName("quiet")}
                    href={project.liveUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Live site ↗
                  </a>
                )}
              </div>
            ) : null}
          </div>

          {hasRail && (
            <aside aria-label="Project details" className="project-rail">
              {project.stack.length > 0 && (
                <div>
                  <p className={kicker}>Stack</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {project.stack.map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {(project.repoUrl || project.liveUrl) && (
                <div className={project.stack.length > 0 ? "mt-8" : undefined}>
                  <p className={kicker}>Links</p>
                  <ul className="mt-3 space-y-2">
                    {project.repoUrl && (
                      <li>
                        <a
                          className={railLink}
                          href={project.repoUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className={railLabel}>
                            Repository
                            <span aria-hidden="true">↗</span>
                          </span>
                          <span className="text-muted [overflow-wrap:anywhere]">
                            {hostOf(project.repoUrl)}
                          </span>
                        </a>
                      </li>
                    )}
                    {project.liveUrl && (
                      <li>
                        <a
                          className={railLink}
                          href={project.liveUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className={railLabel}>
                            Live site
                            <span aria-hidden="true">↗</span>
                          </span>
                          <span className="text-muted [overflow-wrap:anywhere]">
                            {hostOf(project.liveUrl)}
                          </span>
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

function ProjectNotFound() {
  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="py-[clamp(4rem,12vw,8rem)]">
          <p className={kicker}>404</p>
          <p className="mt-5 font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            That project does not exist.
          </p>
          <Link className={`${buttonClassName("quiet")} mt-8`} to="/work">
            All work
          </Link>
        </div>
      </div>
    </main>
  );
}
