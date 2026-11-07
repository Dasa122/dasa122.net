import type { ReactNode } from "react";

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[color-mix(in_oklab,var(--text)_4%,transparent)] px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
      {children}
    </span>
  );
}
