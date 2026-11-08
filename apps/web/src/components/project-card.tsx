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
 * A large work card: a solid tinted cover carrying the project's initial, then
 * the title, the summary and the stack. The title link is stretched over the
 * whole card, so the card is the hit area.
 *
 * The cover comes from the card's position (`index % 5`), so the sequence is
 * stable as data changes and server render matches hydration.
 */
export function ProjectCard({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  const initial = project.title.trim().charAt(0).toUpperCase() || "·";
  const cover =
    PROJECT_COVERS[index % PROJECT_COVERS.length] ?? PROJECT_COVERS[0];

  return (
    <article className="rail-card glass-panel group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] transition-[translate,box-shadow] duration-500 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] motion-reduce:hover:translate-y-0">
      <Link
        aria-label={project.title}
        className="absolute inset-0 z-10 rounded-[var(--radius-lg)]"
        params={{ slug: project.slug }}
        to="/work/$slug"
      />

      <div
        aria-hidden="true"
        className="rail-card-cover relative flex items-center justify-center border-b border-[var(--hairline)]"
        style={{ background: cover }}
      >
        <span className="relative font-display text-[clamp(2.75rem,4.5vw,3.75rem)] font-semibold leading-none tracking-[-0.04em] text-ember-text">
          {initial}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <h3 className="[overflow-wrap:anywhere] text-2xl leading-[1.02] tracking-[-0.045em]">
          {project.title}
        </h3>
        <p className="max-w-[46ch] text-muted">{project.summary}</p>
        {project.stack.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {project.stack.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
