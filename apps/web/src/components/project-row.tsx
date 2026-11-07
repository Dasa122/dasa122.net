import type { projectSchema } from "@dasa122/contract";
import { Meta } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";

export type Project = ReturnType<typeof projectSchema.parse>;

/**
 * One line of the featured-work strip: title link, a one-line summary, and the
 * stack. A row, not a card — the parent supplies the hairline rules.
 */
export function ProjectRow({ project }: { project: Project }) {
  const className =
    "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text";

  return (
    <article className="py-6">
      <h3 className="text-2xl leading-tight tracking-[-0.01em] md:text-3xl">
        <Link
          className={className}
          params={{ slug: project.slug }}
          to="/work/$slug"
        >
          {project.title}
        </Link>
      </h3>
      <p className="mt-2 max-w-[60ch] text-muted">{project.summary}</p>
      {project.stack.length > 0 && (
        <div className="mt-3">
          <Meta>{project.stack.join(" · ")}</Meta>
        </div>
      )}
    </article>
  );
}
