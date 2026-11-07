import type { adminStatsSchema } from "@dasa122/contract";
import { DataPanel, Meta, Rule, Section } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { adminStatsOptions } from "../../utils/admin-stats";
import { formatNumber, formatRelativeTime } from "../../utils/format";

type SyncState = ReturnType<typeof adminStatsSchema.parse>["lastSync"][number];

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
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
    <div>
      <p className={eyebrow}>{label}</p>
      <p className="mt-2 font-mono text-4xl leading-none tabular-nums">
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
        <Section>
          <header>
            <p className={eyebrow}>Admin</p>
            <h1 className={`mt-2 ${heading}`}>Dashboard</h1>
          </header>

          <div className="mt-10">
            <Rule />
            {stats.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading admin data…
              </p>
            )}
            {stats.isError && (
              <p className={`py-5 ${errorText}`}>Could not load admin data.</p>
            )}
          </div>

          {data && (
            <>
              <div className="mt-10 grid grid-cols-2 gap-x-8">
                <Stat label="Published" value={data.published} />
                <Stat label="Drafts" value={data.drafts} />
              </div>

              <div className="mt-12">
                <h2 className={eyebrow}>By source</h2>
                <div className="mt-4">
                  <Rule />
                  {sources.length === 0 ? (
                    <p className="py-5 font-mono text-[0.75rem] text-muted">
                      No posts yet.
                    </p>
                  ) : (
                    sources.map(([source, value], index) => (
                      <Fragment key={source}>
                        {index > 0 && <Rule />}
                        <div className="flex items-baseline justify-between py-3">
                          <span className="font-mono text-[0.75rem] uppercase tracking-[0.14em]">
                            {source}
                          </span>
                          <Meta>{formatNumber(value)}</Meta>
                        </div>
                      </Fragment>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-12">
                <DataPanel title="SYNC STATUS">
                  {syncStates.length === 0 ? (
                    <p className={muted}>No sync sources yet.</p>
                  ) : (
                    syncStates.map((sync, index) => (
                      <Fragment key={sync.source}>
                        {index > 0 && <Rule />}
                        <SyncRow sync={sync} />
                      </Fragment>
                    ))
                  )}
                </DataPanel>
              </div>
            </>
          )}
        </Section>
      </div>
    </main>
  );
}
