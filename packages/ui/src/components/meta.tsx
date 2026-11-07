import type { ReactNode } from "react";

export function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.75rem] text-muted tabular-nums">
      {children}
    </span>
  );
}
