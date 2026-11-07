import { DataPanel } from "@dasa122/ui";

export type ActivityDay = {
  count: number;
  date: string;
};

const MAX_BAR_HEIGHT = 80;
// Capping the scale denominator keeps a single outlier day from flattening
// every other bar; the rendered height is capped too.
const PEAK_CAP = 20;

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
              ? 1
              : Math.min(
                  MAX_BAR_HEIGHT,
                  Math.max(3, Math.round((day.count / scale) * MAX_BAR_HEIGHT)),
                );
          return (
            <div
              className="flex min-w-[1.125rem] flex-col items-center gap-1"
              key={day.date}
            >
              <div className="flex h-20 w-full items-end">
                <div
                  className="w-full bg-ink"
                  style={{ height: `${height}px` }}
                  title={`${day.date}: ${day.count}`}
                />
              </div>
              <span className="font-mono text-[0.5625rem] tabular-nums text-muted">
                {day.count}
              </span>
              <span className="font-mono text-[0.5rem] text-muted [writing-mode:vertical-rl]">
                {day.date}
              </span>
            </div>
          );
        })}
      </div>
    </DataPanel>
  );
}
