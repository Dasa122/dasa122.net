import type { projectSchema } from "@dasa122/contract";
import { Tag } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";

export type Project = ReturnType<typeof projectSchema.parse>;

/** Four covers, all from the same vivid family in both palettes. */
const COVERS = [
  "linear-gradient(140deg, var(--cover-1), var(--cover-2))",
  "linear-gradient(140deg, var(--cover-2), var(--cover-3))",
  "linear-gradient(140deg, var(--cover-4), var(--cover-5))",
  "linear-gradient(140deg, var(--cover-3), var(--cover-2))",
] as const;

/**
 * A stable cover per project: the same slug always paints the same gradient,
 * so the server render and the hydration agree without a random seed.
 */
function coverFor(slug: string): string {
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  }
  return COVERS[hash % COVERS.length] ?? COVERS[0];
}

/**
 * A large work card: a gradient cover carrying the project's initial, then the
 * title, the summary and the stack. The title link is stretched over the whole
 * card, so the card is the hit area.
 */
export function ProjectCard({ project }: { project: Project }) {
  const initial = project.title.trim().charAt(0).toUpperCase() || "·";

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
        className="rail-card-cover relative flex items-end p-6"
        style={{ backgroundImage: coverFor(project.slug) }}
      >
        <div aria-hidden="true" className="cover-scrim absolute inset-0" />
        <span className="relative font-display text-[clamp(4rem,8vw,7rem)] font-semibold leading-none tracking-[-0.06em] text-white/90 drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]">
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
