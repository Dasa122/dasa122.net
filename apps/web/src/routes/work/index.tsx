import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProjectCard } from "../../components/project-card";
import { SectionHeading } from "../../components/section-heading";
import { canonicalOrigin } from "../../utils/canonical";
import { orpc } from "../../utils/orpc";

const TITLE = "Work — Dasa122";
const DESCRIPTION =
  "Selected projects — the software Dasa122 has built, the stack behind it, and where to find it.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const page = `${frame} pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(4rem,10vw,9rem)]`;

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
 * The work index as a card grid: the same `ProjectCard` the home rail uses, one
 * column on phones, two from `sm` and three from `xl`.
 */
export function WorkIndex() {
  const projects = useQuery(projectsOptions);
  const items = projects.data?.items ?? [];

  return (
    <main className="flex-1">
      <div className={page}>
        <header>
          <SectionHeading as="h1" label="Projects" title="Work" />
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted">
            Selected projects — what was built, the stack behind it, and where
            to find it.
          </p>
        </header>

        {projects.isPending && (
          <p className="mt-10 font-mono text-[0.75rem] text-muted">
            Loading work…
          </p>
        )}
        {projects.isError && (
          <p className="mt-10 font-mono text-[0.75rem] text-ember-text">
            Could not load the work.
          </p>
        )}
        {projects.isSuccess && items.length === 0 && (
          <p className="mt-10 font-mono text-[0.75rem] text-muted">
            Nothing published yet.
          </p>
        )}

        {items.length > 0 && (
          <div className="reveal mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((project, index) => (
              <ProjectCard index={index} key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
