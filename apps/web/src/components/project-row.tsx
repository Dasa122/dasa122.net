import type { projectSchema } from "@dasa122/contract";
import { Meta } from "@dasa122/ui";
import { Link, useRouter } from "@tanstack/react-router";

export type Project = ReturnType<typeof projectSchema.parse>;

/**
 * One line of the featured-work strip: title link, a one-line summary, and the
 * stack. A row, not a card — the parent supplies the hairline rules.
 */
export function ProjectRow({ project }: { project: Project }) {
  // The row also renders outside a router (static markup in tests); fall back
  // to a plain anchor there so the markup does not need a provider.
  const router = useRouter({ warn: false });
  const className =
    "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text";
  const title = project.title;
  const href = `/work/${project.slug}`;

  return (
    <article className="py-6">
      <h3 className="text-2xl leading-tight tracking-[-0.01em] md:text-3xl">
        {/* The work routes arrive in their own task; `to` is cast so the link
            is already router-aware without the generated route tree. */}
        {router ? (
          <Link className={className} to={href as never}>
            {title}
          </Link>
        ) : (
          <a className={className} href={href}>
            {title}
          </a>
        )}
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
