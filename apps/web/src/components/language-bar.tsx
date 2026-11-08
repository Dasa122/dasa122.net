/** The four accent shades for the largest languages, then one neutral. */
const FILLS = [
  "var(--acc)",
  "var(--acc-text)",
  "var(--acc-fill)",
  "var(--acc-deep)",
] as const;
const REST = "color-mix(in oklab, var(--color-muted) 42%, transparent)";

function fillAt(index: number): string {
  return FILLS[index] ?? REST;
}

/**
 * The language breakdown as one stacked bar plus a legend. The four largest
 * languages get the palette's accent shades and everything else shares a
 * neutral, so the bar reads as a ranking rather than a swatch chart.
 */
export function LanguageBar({
  languages,
}: {
  languages: Record<string, number>;
}) {
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) {
    return (
      <p className="font-mono text-[0.75rem] text-muted">No language data.</p>
    );
  }

  return (
    <div>
      <div
        aria-hidden="true"
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-[var(--radius-pill)]"
      >
        {entries.map(([language, count], index) => (
          <div
            className="h-full first:rounded-l-[var(--radius-pill)] last:rounded-r-[var(--radius-pill)]"
            key={language}
            style={{
              background: fillAt(index),
              width: `${(count / total) * 100}%`,
            }}
            title={language}
          />
        ))}
      </div>

      <ul className="mt-5 flex flex-wrap gap-2">
        {entries.map(([language, count], index) => (
          <li
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--glass-edge)] bg-[var(--glass-bg)] px-3 py-1.5 text-[0.8125rem] leading-none text-ink shadow-[inset_0_1px_0_var(--glass-hi)]"
            key={language}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: fillAt(index) }}
            />
            <span className="max-w-[12ch] truncate">{language}</span>
            <span className="font-mono text-[0.6875rem] tabular-nums text-muted">
              {Math.round((count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
