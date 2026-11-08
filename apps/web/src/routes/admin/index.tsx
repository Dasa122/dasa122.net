import type { adminStatsSchema } from "@dasa122/contract";
import { DataPanel, Meta } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AdminHeading } from "../../components/admin-heading";
import { adminStatsOptions } from "../../utils/admin-stats";
import { formatNumber, formatRelativeTime } from "../../utils/format";

type SyncState = ReturnType<typeof adminStatsSchema.parse>["lastSync"][number];

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin — Dasa122" }] }),
  loader: ({ context }) =>
    context.forbidden
      ? undefined
      : context.queryClient.prefetchQuery(adminStatsOptions),
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card p-6 sm:p-7">
      <p className={eyebrow}>{label}</p>
      <p className="mt-3 font-display text-[clamp(2.75rem,7vw,4.5rem)] font-semibold leading-none tracking-[-0.05em] tabular-nums">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function SyncRow({ sync }: { sync: SyncState }) {
  const status =
    sync.lastStatus === "not_configured"
      ? "Not configured"
      : (sync.lastStatus ?? "Never run");

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-mono text-[0.75rem] uppercase tracking-[0.14em]">
          {sync.source}
        </span>
        <Meta>
          {sync.lastRunAt
            ? `Last run ${formatRelativeTime(sync.lastRunAt)}`
            : "Never run"}
        </Meta>
      </div>
      <p className={`mt-1 ${muted}`}>{status}</p>
      {sync.lastStatus === "error" && sync.lastError && (
        <p className={`mt-1 ${muted}`}>{sync.lastError}</p>
      )}
    </div>
  );
}

function AdminDashboard() {
  const stats = useQuery(adminStatsOptions);
  const data = stats.data;

  const sources = Object.entries(data?.bySource ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const syncStates = [...(data?.lastSync ?? [])].sort((a, b) =>
    a.source.localeCompare(b.source),
  );

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading title="Dashboard" />

          {stats.isPending && (
            <p className="mt-10 font-mono text-[0.75rem] text-muted">
              Loading admin data…
            </p>
          )}
          {stats.isError && (
            <p className={`mt-10 ${errorText}`}>Could not load admin data.</p>
          )}

          {data && (
            <>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <Stat label="Published" value={data.published} />
                <Stat label="Drafts" value={data.drafts} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <DataPanel title="BY SOURCE">
                  {sources.length === 0 ? (
                    <p className={`py-2 ${muted}`}>No posts yet.</p>
                  ) : (
                    <div className="divide-y divide-[var(--color-rule)]">
                      {sources.map(([source, value]) => (
                        <div
                          className="flex items-baseline justify-between py-3"
                          key={source}
                        >
                          <span className="font-mono text-[0.75rem] uppercase tracking-[0.14em]">
                            {source}
                          </span>
                          <span className="font-display text-2xl leading-none tabular-nums">
                            {formatNumber(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </DataPanel>

                <DataPanel title="SYNC STATUS">
                  {syncStates.length === 0 ? (
                    <p className={muted}>No sync sources yet.</p>
                  ) : (
                    <div className="divide-y divide-[var(--color-rule)]">
                      {syncStates.map((sync) => (
                        <SyncRow key={sync.source} sync={sync} />
                      ))}
                    </div>
                  )}
                </DataPanel>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
