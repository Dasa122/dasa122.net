type Source = "own" | "github" | "linkedin";

const labels: Record<Source, string> = {
  github: "GITHUB",
  linkedin: "LINKEDIN",
  own: "NOTE",
};

/**
 * The source tokens are the only place colour carries meaning here: teal for
 * GitHub, blue for LinkedIn, ember for a note. Each is measured at 4.5:1 or
 * better against its own 12% tint in both palettes.
 */
const tones: Record<Source, string> = {
  github:
    "text-source-github bg-[color-mix(in_oklab,var(--color-source-github)_12%,transparent)]",
  linkedin:
    "text-source-linkedin bg-[color-mix(in_oklab,var(--color-source-linkedin)_12%,transparent)]",
  own: "text-source-note bg-[color-mix(in_oklab,var(--color-source-note)_12%,transparent)]",
};

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] ${tones[source]}`}
    >
      {labels[source]}
    </span>
  );
}
