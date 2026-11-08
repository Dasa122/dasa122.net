import { type ReactNode, useId } from "react";

/**
 * One data panel: a glass card with a mono label. It is a `section` rather than
 * a `fieldset` so the label reads as a card heading instead of a notched
 * legend; `aria-labelledby` keeps the same grouping for assistive tech.
 */
export function DataPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="glass-card p-5 sm:p-6">
      <h2
        className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted"
        id={id}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
