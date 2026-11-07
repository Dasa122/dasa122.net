import type { ReactNode } from "react";

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
          className={`${label ? "mt-2 " : ""}font-display text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.05] tracking-[-0.02em]`}
        >
          {title}
        </Tag>
      </div>
      {action !== undefined && <div className="pb-1">{action}</div>}
    </div>
  );
}
