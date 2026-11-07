import { buttonClassName, Rule, Section, Tag } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canonicalOrigin } from "../../utils/canonical";
import { isNotFound } from "../../utils/errors";
import { type api, orpc } from "../../utils/orpc";

type ProjectDetail = Awaited<ReturnType<typeof api.projects.bySlug>>;

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";

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

  return (
    <main className="flex-1">
      <div className={frame}>
        <article className="py-[clamp(3.5rem,9vw,7rem)]">
          <header>
            <h1 className="max-w-[24ch] font-display text-[clamp(2.75rem,7vw,5rem)] leading-[1.02] tracking-[-0.02em]">
              {project.title}
            </h1>
            <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink">
              {project.summary}
            </p>

            {project.stack.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {project.stack.map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            )}

            {(project.repoUrl || project.liveUrl) && (
              <div className="mt-8 flex flex-wrap items-baseline gap-4">
                {project.repoUrl && (
                  <a
                    className={buttonClassName("quiet")}
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
            )}
          </header>
        </article>
      </div>
    </main>
  );
}

function ProjectNotFound() {
  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
            404
          </p>
          <div className="mt-4">
            <Rule />
          </div>
          <p className="mt-4 font-mono text-[0.75rem] text-muted">
            That project does not exist.
          </p>
        </Section>
      </div>
    </main>
  );
}
