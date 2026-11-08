import type { ReactNode } from "react";

/**
 * The one heading for every admin page: the mono section label, the page title
 * in display type, and an optional action pinned to the baseline on the right.
 */
export function AdminHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
          Admin
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[0.96] tracking-[-0.045em]">
          {title}
        </h1>
      </div>
      {action !== undefined && <div className="pb-1">{action}</div>}
    </header>
  );
}
