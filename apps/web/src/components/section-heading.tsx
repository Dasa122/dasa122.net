import type { ReactNode } from "react";

/**
 * The section's mono kicker. Rendered as a sibling of the rows rather than
 * inside the heading block, so it can stay pinned for the length of the
 * section while its rows scroll past (above md only — see `app.css`).
 */
export function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <p className="section-kicker -mx-1 mb-1 px-1 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
      {children}
    </p>
  );
}

/**
 * The one heading pattern for the site: a mono kicker, a display title, and an
 * optional quiet action pinned to the baseline of the right edge. Interior
 * pages pass `as="h1"` for the page title; everything else is an `h2`.
 */
export function SectionHeading({
  as: Tag = "h2",
  label,
  title,
  action,
}: {
  as?: "h1" | "h2" | "h3";
  label?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        {label && (
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted">
            {label}
          </p>
        )}
        <Tag
          className={`${label ? "mt-2 " : ""}font-display text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.045em]`}
        >
          {title}
        </Tag>
      </div>
      {action !== undefined && <div className="pb-1">{action}</div>}
    </div>
  );
}
