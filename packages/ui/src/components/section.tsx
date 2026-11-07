import type { ReactNode } from "react";

export function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`py-[clamp(4rem,10vw,9rem)]${className ? ` ${className}` : ""}`}
    >
      {children}
    </section>
  );
}
