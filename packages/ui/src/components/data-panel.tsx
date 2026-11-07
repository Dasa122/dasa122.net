import type { ReactNode } from "react";

export function DataPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border border-rule px-4 pb-4">
      <legend className="px-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
        {title}
      </legend>
      <div className="pt-3">{children}</div>
    </fieldset>
  );
}
