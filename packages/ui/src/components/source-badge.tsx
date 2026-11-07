type Source = "own" | "github" | "linkedin";

const labels: Record<Source, string> = {
  github: "GITHUB",
  linkedin: "LINKEDIN",
  own: "NOTE",
};

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ember-text">
      {labels[source]}
    </span>
  );
}
