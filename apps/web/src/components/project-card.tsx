import type { projectSchema } from "@dasa122/contract";
import { Tag } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";

export type Project = ReturnType<typeof projectSchema.parse>;

/** Five covers, each a hue plus a darker sibling, so cards read as artwork. */
const COVERS = [
  "linear-gradient(140deg, var(--cover-1), var(--cover-1-deep))",
  "linear-gradient(140deg, var(--cover-2), var(--cover-2-deep))",
  "linear-gradient(140deg, var(--cover-3), var(--cover-3-deep))",
  "linear-gradient(140deg, var(--cover-4), var(--cover-4-deep))",
  "linear-gradient(140deg, var(--cover-5), var(--cover-5-deep))",
] as const;

/**
 * A large work card: a gradient cover carrying the project's initial, then the
 * title, the summary and the stack. The title link is stretched over the whole
 * card, so the card is the hit area.
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
  const cover = COVERS[index % COVERS.length] ?? COVERS[0];

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
        style={{ backgroundImage: cover }}
      >
        <div aria-hidden="true" className="cover-scrim absolute inset-0" />
        <span className="relative font-display text-[clamp(4rem,8vw,7rem)] font-semibold leading-none tracking-[-0.06em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]">
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
