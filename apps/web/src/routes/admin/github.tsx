import { Button, DataPanel, Meta, Rule, Section } from "@dasa122/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { formatNumber, formatRelativeTime } from "../../utils/format";
import { orpc } from "../../utils/orpc";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
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
        <Section>
          <header>
            <p className={eyebrow}>Admin</p>
            <h1 className={`mt-2 ${heading}`}>GitHub</h1>
          </header>

          <div className="mt-10">
            {status.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading the GitHub snapshot…
              </p>
            )}
            {status.isError && (
              <p className={`py-5 ${errorText}`}>
                Could not load the GitHub snapshot.
              </p>
            )}
          </div>

          {data && (
            <>
              <DataPanel title="CONNECTION">
                <div className="space-y-5 py-2">
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

              <div className="mt-8">
                <Button
                  disabled={sync.isPending}
                  onClick={() => sync.mutate({})}
                  variant="solid"
                >
                  SYNC NOW
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

              <div className="mt-12">
                <DataPanel title="REPOSITORIES">
                  {repos.length === 0 ? (
                    <p className={`py-3 ${muted}`}>
                      No repositories in the cached snapshot yet. Run a sync to
                      populate it.
                    </p>
                  ) : (
                    repos.map((repo, index) => {
                      const isFeatured = featuredNames.has(repo.name);
                      return (
                        <Fragment key={repo.name}>
                          {index > 0 && <Rule />}
                          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-4">
                            <div className="min-w-0">
                              <h2 className="font-mono text-base leading-snug">
                                <a
                                  className="transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text"
                                  href={repo.url}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {repo.name}
                                </a>
                              </h2>
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
                              {isFeatured ? "FEATURED" : "FEATURE"}
                            </Button>
                          </div>
                        </Fragment>
                      );
                    })
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
        </Section>
      </div>
    </main>
  );
}
