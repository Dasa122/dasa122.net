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
    <article className="group relative -mx-3 rounded-[var(--radius-md)] px-3 py-6 pr-10 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[var(--color-surface-2)] active:scale-[0.998]">
      <h3 className="text-2xl leading-tight tracking-[-0.01em] transition-transform duration-200 group-hover:translate-x-1 md:text-3xl">
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
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ember-text opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        ↗
      </span>
    </article>
  );
}
