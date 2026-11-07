const SWATCHES = ["bg-ink", "bg-muted", "bg-ember-fill", "bg-rule"];

/**
 * The language breakdown as one stacked bar plus a legend. Each row shows the
 * language and its share in tabular figures.
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
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden">
        {entries.map(([language, count], index) => (
          <div
            className={SWATCHES[index % SWATCHES.length] ?? "bg-rule"}
            key={language}
            style={{ width: `${(count / total) * 100}%` }}
            title={language}
          />
        ))}
      </div>

      <dl className="mt-4 space-y-2">
        {entries.map(([language, count], index) => (
          <div
            className="flex items-baseline justify-between gap-4"
            key={language}
          >
            <dt className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 ${SWATCHES[index % SWATCHES.length] ?? "bg-rule"}`}
              />
              <span>{language}</span>
            </dt>
            <dd className="font-mono text-[0.75rem] tabular-nums text-muted">
              {Math.round((count / total) * 100)}%
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
