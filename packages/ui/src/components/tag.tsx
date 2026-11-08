import type { ReactNode } from "react";

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--glass-edge)] bg-[var(--glass-bg)] px-2.5 py-1 font-mono text-[0.625rem] uppercase leading-none tracking-[0.12em] text-muted shadow-[inset_0_1px_0_var(--glass-hi)]">
      {children}
    </span>
  );
}
