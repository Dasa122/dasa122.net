import { DataPanel, Meta } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityChart } from "../components/activity-chart";
import { LanguageBar } from "../components/language-bar";
import { RepoRow } from "../components/repo-row";
import { canonicalOrigin } from "../utils/canonical";
import { formatDate, formatNumber } from "../utils/format";
import { orpc } from "../utils/orpc";

const TITLE = "GitHub — Dasa122";
const DESCRIPTION =
  "Repositories, languages, commits, and activity from GitHub — read from a cached snapshot.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const muted = "font-mono text-[0.75rem] text-muted";

// One options object shared by the loader's prefetch and the component's
// `useQuery` so the server render is never fetched twice.
const overviewOptions = orpc.github.overview.queryOptions({ input: {} });

export const Route = createFileRoute("/github/")({
  component: GitHubPage,
  head: () => {
    const canonical = `${canonicalOrigin()}/github`;
    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title: TITLE },
        { content: DESCRIPTION, name: "description" },
        { content: TITLE, property: "og:title" },
        { content: DESCRIPTION, property: "og:description" },
        { content: canonical, property: "og:url" },
        { content: "website", property: "og:type" },
      ],
    };
  },
  loader: ({ context }) => context.queryClient.prefetchQuery(overviewOptions),
});

function NotSynced() {
  return <p className={muted}>Not synced yet.</p>;
}

/**
 * The public page that uses the terminal / data-panel vocabulary: four panels
 * for the repositories, languages, commits, and daily activity.
 */
export function GitHubPage() {
  const overview = useQuery(overviewOptions);
  const data = overview.data;

  return (
    <main className="flex-1">
      <div className={frame}>
        <header className="pt-[clamp(2.5rem,6vw,4.5rem)]">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
            Open source
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[0.94] tracking-[-0.045em]">
            GitHub
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">
            Repositories, languages, commits, and activity — read from a cached
            snapshot rather than a live GitHub call.
          </p>
          {data && (
            <div className="mt-4">
              <Meta>
                {data.lastSyncedAt
                  ? `Last synced ${formatDate(data.lastSyncedAt)}`
                  : "Never synced"}
              </Meta>
            </div>
          )}
        </header>

        <div className="pt-10 pb-[clamp(4rem,10vw,9rem)]">
          {overview.isPending && <p className={muted}>Loading GitHub data…</p>}
          {overview.isError && (
            <p className="font-mono text-[0.75rem] text-ember-text">
              Could not load GitHub data.
            </p>
          )}

          {data &&
            (data.lastSyncedAt === null ? (
              // Never synced is not the same as having no repositories, so
              // every panel says so instead of reading as empty data.
              <div className="grid gap-4 md:grid-cols-2">
                <DataPanel title="REPOSITORIES">
                  <NotSynced />
                </DataPanel>
                <DataPanel title="LANGUAGES">
                  <NotSynced />
                </DataPanel>
                <DataPanel title="COMMITS (RECENT)">
                  <NotSynced />
                </DataPanel>
                <DataPanel title="ACTIVITY">
                  <NotSynced />
                </DataPanel>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-3">
                  <DataPanel title="REPOSITORIES">
                    {data.repos.length === 0 ? (
                      <p className={muted}>No repositories yet.</p>
                    ) : (
                      <div className="divide-y divide-[var(--color-rule)]">
                        {data.repos.map((repo) => (
                          <RepoRow key={repo.name} repo={repo} />
                        ))}
                      </div>
                    )}
                  </DataPanel>
                </div>

                <div className="lg:col-span-2">
                  <DataPanel title="LANGUAGES">
                    <LanguageBar languages={data.languages} />
                  </DataPanel>
                </div>

                {/* `totalCommits` is a rolling window — the sum of
                    `payload.size` over at most the 100 most recent fetched
                    events — so the panel is labelled "recent". */}
                <DataPanel title="COMMITS (RECENT)">
                  <p className="font-display text-[clamp(3rem,7vw,4.5rem)] font-semibold leading-none tracking-[-0.05em] tabular-nums">
                    {formatNumber(data.totalCommits)}
                  </p>
                  <p className="mt-3 font-mono text-[0.6875rem] leading-relaxed text-muted">
                    Sum of the last 100 fetched events, not a lifetime total.
                  </p>
                </DataPanel>

                <div className="lg:col-span-3">
                  <ActivityChart activity={data.activity} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
