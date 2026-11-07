import type { projectSchema } from "@dasa122/contract";
import { Meta } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";
import { useSpotlight } from "../hooks/use-spotlight";

export type Project = ReturnType<typeof projectSchema.parse>;

/**
 * One line of the featured-work strip: title link, a one-line summary, and the
 * stack. A row, not a card — the parent supplies the hairline rules.
 *
 * The title link is stretched over the whole row with an absolutely positioned
 * `::after`, so clicking anywhere on the row navigates. The spotlight is the
 * row's first child, so it paints under that hit area and under the focus ring.
 */
export function ProjectRow({ project }: { project: Project }) {
  const spotlight = useSpotlight<HTMLElement>();

  const linkClass =
    "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] after:absolute after:inset-0 after:content-[''] hover:text-ember-text";

  return (
    <article
      className="group row-lift relative -mx-3 rounded-[var(--radius-md)] px-3 py-6 pr-10 hover:bg-[var(--color-surface-2)] has-[a:active]:scale-[0.998]"
      ref={spotlight.ref}
      {...spotlight.handlers}
    >
      <span aria-hidden="true" className="row-spotlight" />
      <h3 className="text-2xl leading-tight tracking-[-0.01em]">
        <Link
          className={linkClass}
          params={{ slug: project.slug }}
          to="/work/$slug"
        >
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
            {project.title}
          </span>
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
