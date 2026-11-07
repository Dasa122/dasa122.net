import { DataPanel, Meta, Rule } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
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
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const muted = "font-mono text-[0.75rem] text-muted";

// One options object shared by the loader's prefetch and the component's
// `useQuery` so the server render is never fetched twice.
const overviewOptions = orpc.github.overview.queryOptions({ input: {} });

export const Route = createFileRoute("/github")({
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
 * The only page that uses the terminal / data-panel vocabulary: four panels
 * for the repositories, languages, commits, and daily activity.
 */
export function GitHubPage() {
  const overview = useQuery(overviewOptions);
  const data = overview.data;

  return (
    <main className="flex-1">
      <div className={frame}>
        <header className="py-[clamp(3.5rem,9vw,7rem)]">
          <h1 className={heading}>GitHub</h1>
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ink">
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

        <div className="pb-[clamp(4rem,10vw,9rem)]">
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
              <div className="space-y-4">
                <DataPanel title="REPOSITORIES">
                  {data.repos.length === 0 ? (
                    <p className={muted}>No repositories yet.</p>
                  ) : (
                    data.repos.map((repo, index) => (
                      <Fragment key={repo.name}>
                        {index > 0 && <Rule />}
                        <RepoRow repo={repo} />
                      </Fragment>
                    ))
                  )}
                </DataPanel>

                <div className="grid gap-4 md:grid-cols-2">
                  <DataPanel title="LANGUAGES">
                    <LanguageBar languages={data.languages} />
                  </DataPanel>

                  {/* `totalCommits` is a rolling window — the sum of
                      `payload.size` over at most the 100 most recent fetched
                      events — so the panel is labelled "recent". */}
                  <DataPanel title="COMMITS (RECENT)">
                    <p className="font-display text-5xl tabular-nums">
                      {formatNumber(data.totalCommits)}
                    </p>
                    <p className="mt-3 font-mono text-[0.6875rem] text-muted">
                      Sum of the last 100 fetched events, not a lifetime total.
                    </p>
                  </DataPanel>
                </div>

                <ActivityChart activity={data.activity} />
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
