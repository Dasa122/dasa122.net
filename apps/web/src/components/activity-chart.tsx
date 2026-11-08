import { DataPanel } from "@dasa122/ui";

export type ActivityDay = {
  count: number;
  date: string;
};

const MAX_BAR_HEIGHT = 96;
// Capping the scale denominator keeps a single outlier day from flattening
// every other bar; the rendered height is capped too.
const PEAK_CAP = 20;

/** `2026-11-05` → `11-05`, so the axis fits under a narrow bar. */
function shortDate(date: string): string {
  return date.slice(5);
}

/**
 * A row of bars, one per day, built from plain elements — no chart library.
 * Each bar's height is proportional to that day's count, capped so one large
 * day cannot dominate the panel. The count and date sit under each bar in the
 * mono face.
 */
export function ActivityChart({ activity }: { activity: ActivityDay[] }) {
  if (activity.length === 0) {
    return (
      <DataPanel title="ACTIVITY">
        <p className="font-mono text-[0.75rem] text-muted">No activity yet</p>
      </DataPanel>
    );
  }

  const peak = activity.reduce((max, day) => Math.max(max, day.count), 0);
  const scale = Math.min(Math.max(peak, 1), PEAK_CAP);

  return (
    <DataPanel title="ACTIVITY">
      <div className="flex items-end gap-[3px] overflow-x-auto pb-1">
        {activity.map((day) => {
          const height =
            day.count === 0
              ? 2
              : Math.min(
                  MAX_BAR_HEIGHT,
                  Math.max(4, Math.round((day.count / scale) * MAX_BAR_HEIGHT)),
                );
          return (
            <div
              className="flex min-w-[1.125rem] flex-col items-center gap-1.5"
              key={day.date}
            >
              <span className="font-mono text-[0.5625rem] tabular-nums text-muted">
                {day.count}
              </span>
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t-[3px] rounded-b-[1px] bg-[var(--acc)]"
                  style={{ height: `${height}px` }}
                  title={`${day.date}: ${day.count}`}
                />
              </div>
              <span className="font-mono text-[0.5rem] text-muted [writing-mode:vertical-rl]">
                {shortDate(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </DataPanel>
  );
}
