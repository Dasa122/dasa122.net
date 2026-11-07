import type { ReactNode } from "react";

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block border border-rule bg-rule/30 px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
      {children}
    </span>
  );
}
