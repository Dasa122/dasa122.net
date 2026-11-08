import { Button, DataPanel, Meta } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminHeading } from "../../components/admin-heading";
import { formatNumber, formatRelativeTime } from "../../utils/format";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const eyebrow =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted";
const muted = "font-mono text-[0.75rem] text-muted";
const errorText = "font-mono text-[0.75rem] text-ember-text";

const statusOptions = orpc.adminGithub.status.queryOptions({ input: {} });

export const Route = createFileRoute("/admin/github")({
  component: AdminGithub,
  head: () => ({ meta: [{ title: "GitHub — Admin" }] }),
  loader: ({ context }) =>
    context.forbidden
      ? undefined
      : context.queryClient.prefetchQuery(statusOptions),
});

function AdminGithub() {
  const status = useQuery(statusOptions);
  const queryClient = useQueryClient();
  const [optimisticFeatured, setOptimisticFeatured] = useState<string[] | null>(
    null,
  );

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.adminGithub.status.key(),
    });
  };

  const sync = useMutation(
    orpc.adminGithub.sync.mutationOptions({ onSuccess: refresh }),
  );
  const featured = useMutation(
    orpc.adminGithub.featuredRepos.mutationOptions({ onSuccess: refresh }),
  );

  const data = status.data;
  const repos = data?.repos ?? [];
  const serverFeatured = repos
    .filter((repo) => repo.featured)
    .map((repo) => repo.name);
  // The last PATCH response or an in-flight toggle wins over the status query:
  // a second click must build on the first even while the refetch is still in
  // flight.
  const featuredNames = new Set(optimisticFeatured ?? serverFeatured);

  const toggleFeatured = (name: string) => {
    const previous = [...featuredNames];
    const next = new Set(previous);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    const names = [...next];
    setOptimisticFeatured(names);
    featured.mutate(
      { repos: names },
      {
        onError: () => setOptimisticFeatured(previous),
        onSuccess: (result) => setOptimisticFeatured(result.repos),
      },
    );
  };

  const syncError = sync.isError
    ? sync.error.message
    : (sync.data?.error ?? null);

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pb-[clamp(4rem,10vw,9rem)] pt-6">
          <AdminHeading title="GitHub" />

          {status.isPending && (
            <p className="mt-10 font-mono text-[0.75rem] text-muted">
              Loading the GitHub snapshot…
            </p>
          )}
          {status.isError && (
            <p className={`mt-10 ${errorText}`}>
              Could not load the GitHub snapshot.
            </p>
          )}

          {data && (
            <>
              <div className="mt-8">
                <DataPanel title="CONNECTION">
                  <div className="space-y-5">
                    <div>
                      <p className={eyebrow}>Token</p>
                      <p className="mt-1 text-base leading-relaxed text-ink">
                        {data.tokenPresent
                          ? "Configured."
                          : "No token configured — using the unauthenticated public API (60 requests/hour)."}
                      </p>
                    </div>

                    <div>
                      <p className={eyebrow}>Username</p>
                      <p className="mt-1 font-mono text-[0.8125rem] text-ink">
                        {data.username ?? "Not configured"}
                      </p>
                    </div>

                    <div>
                      <p className={eyebrow}>Last run</p>
                      <p className="mt-1 font-mono text-[0.8125rem] text-ink">
                        {data.lastRunAt
                          ? formatRelativeTime(data.lastRunAt)
                          : "Never run"}
                      </p>
                      {data.lastStatus === "error" && data.lastError && (
                        <p className={`mt-1 ${muted}`}>{data.lastError}</p>
                      )}
                    </div>
                  </div>
                </DataPanel>
              </div>

              <div className="mt-6">
                <Button
                  disabled={sync.isPending}
                  onClick={() => sync.mutate({})}
                  variant="solid"
                >
                  Sync now
                </Button>
                <div className="mt-4">
                  {sync.isPending && <p className={muted}>Syncing…</p>}
                  {syncError ? (
                    <p className={errorText}>{syncError}</p>
                  ) : (
                    sync.data && (
                      <p className={muted}>
                        Created {sync.data.created} · Updated{" "}
                        {sync.data.updated} · Skipped {sync.data.skipped}
                      </p>
                    )
                  )}
                </div>
              </div>

              <div className="mt-8">
                <DataPanel title="REPOSITORIES">
                  {repos.length === 0 ? (
                    <p className={`py-2 ${muted}`}>
                      No repositories in the cached snapshot yet. Run a sync to
                      populate it.
                    </p>
                  ) : (
                    <div className="divide-y divide-[var(--color-rule)]">
                      {repos.map((repo) => {
                        const isFeatured = featuredNames.has(repo.name);
                        return (
                          <div
                            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
                            key={repo.name}
                          >
                            <div className="min-w-0">
                              <h3 className="text-lg leading-snug tracking-[-0.02em] [overflow-wrap:anywhere]">
                                <a
                                  className="transition-colors duration-300 ease-[var(--ease-out)] hover:text-ember-text"
                                  href={repo.url}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {repo.name}
                                </a>
                              </h3>
                              <div className="mt-1">
                                <Meta>
                                  {[
                                    repo.language,
                                    `★ ${formatNumber(repo.stars)}`,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </Meta>
                              </div>
                            </div>
                            <Button
                              disabled={featured.isPending}
                              onClick={() => toggleFeatured(repo.name)}
                              variant="quiet"
                            >
                              {isFeatured ? "Featured" : "Feature"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </DataPanel>
                {featured.isError && (
                  <p className={`mt-4 ${errorText}`}>
                    Could not update the featured repositories.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
