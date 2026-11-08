import type { projectSchema } from "@dasa122/contract";
import { Tag } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";

export type Project = ReturnType<typeof projectSchema.parse>;

/** Five solid covers: a neutral surface tinted at most 6% toward the accent,
 * each a step lighter than the last. Only lightness varies, never hue. */
export const PROJECT_COVERS = [
  "color-mix(in oklab, var(--acc) 6%, var(--color-surface-3))",
  "color-mix(in oklab, color-mix(in oklab, var(--acc) 6%, var(--color-surface-3)) 96%, var(--color-paper))",
  "color-mix(in oklab, color-mix(in oklab, var(--acc) 6%, var(--color-surface-3)) 92%, var(--color-paper))",
  "color-mix(in oklab, color-mix(in oklab, var(--acc) 6%, var(--color-surface-3)) 88%, var(--color-paper))",
  "color-mix(in oklab, color-mix(in oklab, var(--acc) 6%, var(--color-surface-3)) 84%, var(--color-paper))",
] as const;

/**
 * The cover a project page gets. Cards get theirs from their position, but a
 * project page has no position, so the slug is hashed instead: the same
 * project always lands on the same cover, on the server and in the browser.
 */
export function coverForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 100_000;
  }
  return PROJECT_COVERS[hash % PROJECT_COVERS.length] ?? PROJECT_COVERS[0];
}

/**
 * A compact work card: a monogram chip and the title, then the summary and the
 * stack. There is no cover panel, so the text sizes the card and a row of them
 * reads as a strip instead of one panel per screen. The title link is stretched
 * over the whole card, so the card is the hit area.
 *
 * `index` stays in the signature even though the card no longer takes a cover
 * from its position; callers keep passing it.
 */
export function ProjectCard({ project }: { project: Project; index: number }) {
  const initial = project.title.trim().charAt(0).toUpperCase() || "·";

  return (
    <article className="rail-card glass-panel group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] p-5 transition-[translate,box-shadow] duration-500 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] motion-reduce:hover:translate-y-0 sm:p-6">
      <Link
        aria-label={project.title}
        className="absolute inset-0 z-10 rounded-[var(--radius-lg)]"
        params={{ slug: project.slug }}
        to="/work/$slug"
      />

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--color-surface-2)] font-display text-[1rem] font-semibold leading-none text-ember-text"
        >
          {initial}
        </span>
        <h3 className="min-w-0 [overflow-wrap:anywhere] text-2xl leading-[1.02] tracking-[-0.045em]">
          {project.title}
        </h3>
      </div>

      <p className="mt-3 max-w-[46ch] text-muted">{project.summary}</p>
      {project.stack.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {project.stack.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </div>
      )}
    </article>
  );
}
