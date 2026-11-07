import { Rule, Section } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { ProjectRow } from "../../components/project-row";
import { canonicalOrigin } from "../../utils/canonical";
import { orpc } from "../../utils/orpc";

const TITLE = "Work — Dasa122";
const DESCRIPTION =
  "Selected projects — the software Dasa122 has built, the stack behind it, and where to find it.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";

// One options object shared by the loader's prefetch and the component's
// `useQuery` so the server render is never fetched twice.
const projectsOptions = orpc.projects.list.queryOptions({ input: {} });

export const Route = createFileRoute("/work/")({
  component: WorkIndex,
  head: () => {
    const canonical = `${canonicalOrigin()}/work`;
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
  loader: ({ context }) => context.queryClient.prefetchQuery(projectsOptions),
});

/**
 * The work index as an editorial index: one full-width row per project,
 * separated by hairlines. No grid, no cards.
 */
export function WorkIndex() {
  const projects = useQuery(projectsOptions);
  const items = projects.data?.items ?? [];

  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <header>
            <h1 className={heading}>Work</h1>
            <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-ink">
              Selected projects — what was built, the stack behind it, and where
              to find it.
            </p>
          </header>

          <div className="mt-8">
            <Rule />
            {projects.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading work…
              </p>
            )}
            {projects.isError && (
              <p className="py-5 font-mono text-[0.75rem] text-ember-text">
                Could not load the work.
              </p>
            )}
            {projects.isSuccess && items.length === 0 && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Nothing published yet.
              </p>
            )}
            {items.map((project, index) => (
              <Fragment key={project.id}>
                {index > 0 && <Rule />}
                <ProjectRow project={project} />
              </Fragment>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
