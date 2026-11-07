type Source = "own" | "github" | "linkedin";

const labels: Record<Source, string> = {
  github: "GITHUB",
  linkedin: "LINKEDIN",
  own: "NOTE",
};

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,var(--color-ember)_10%,transparent)] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ember-text">
      {labels[source]}
    </span>
  );
}
