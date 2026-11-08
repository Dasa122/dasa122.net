import type { githubPullSchema } from "@dasa122/contract";
import { Meta, Prose } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { canonicalOrigin } from "../utils/canonical";
import { formatDate } from "../utils/format";
import { orpc } from "../utils/orpc";

type Pull = ReturnType<typeof githubPullSchema.parse>;

const TITLE = "GitHub — Dasa122";
const DESCRIPTION =
  "Pull requests from GitHub — read from a cached snapshot rather than a live GitHub call.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const muted = "font-mono text-[0.75rem] text-muted";
const groupLabel =
  "font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted";

const pillBase =
  "inline-flex shrink-0 items-center rounded-[var(--radius-pill)] border px-2 py-0.5 font-mono text-[0.625rem] uppercase leading-none tracking-[0.12em]";
const pillOpen =
  "border-[color-mix(in_oklab,var(--color-ember)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-ember)_12%,transparent)] text-ember-text";
const pillMerged =
  "border-[color-mix(in_oklab,var(--color-source-github)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-source-github)_12%,transparent)] text-[var(--color-source-github)]";
const pillClosed =
  "border-[var(--color-rule)] bg-[var(--color-surface-2)] text-muted";

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

/** The state is `open`/`closed` from GitHub; `merged` is the third reading. */
function StatePill({ pull }: { pull: Pull }) {
  const label = pull.merged ? "merged" : pull.state;
  const tone = pull.merged
    ? pillMerged
    : pull.state === "open"
      ? pillOpen
      : pillClosed;

  return <span className={`${pillBase} ${tone}`}>{label}</span>;
}

/** A stable, id-safe key for `aria-controls`; numbers repeat across repos. */
function panelId(pull: Pull): string {
  return `pull-${pull.repo.replace(/[^a-zA-Z0-9_-]/g, "-")}-${pull.number}`;
}

/**
 * One pull request. The whole row is a real button: clicking it expands the
 * description in place. The panel is `hidden` while collapsed and carries an
 * id the button names in `aria-controls`. The reveal is a short opacity/lift
 * animation, disabled outright under `prefers-reduced-motion: reduce`.
 */
function PullRow({ pull }: { pull: Pull }) {
  const [open, setOpen] = useState(false);
  const id = panelId(pull);

  return (
    <li className="border-t border-[var(--color-rule)] first:border-t-0">
      <button
        aria-controls={id}
        aria-expanded={open}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1.5 rounded-[var(--radius-sm)] py-4 text-left transition-colors duration-200 ease-[var(--ease-out)] hover:bg-[var(--glass-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ember)]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="font-mono text-[0.75rem] tabular-nums text-muted">
          #{pull.number}
        </span>
        <span className="min-w-0 flex-1 basis-52 font-medium leading-snug text-ink [overflow-wrap:anywhere]">
          {pull.title}
        </span>
        <span className="font-mono text-[0.6875rem] text-muted [overflow-wrap:anywhere]">
          {pull.repo}
        </span>
        <StatePill pull={pull} />
        <span className="font-mono text-[0.6875rem] tabular-nums text-muted">
          {formatDate(pull.updatedAt)}
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-[0.75rem] text-muted"
        >
          {open ? "−" : "+"}
        </span>
      </button>

      <div className="pb-5" hidden={!open} id={id}>
        {pull.bodyHtml === null ? (
          <p className={`${muted} py-2`}>No description.</p>
        ) : (
          // Sanitised server-side before it reached the snapshot; not
          // sanitised again here, so there is one implementation.
          <div className="pull-body pull-reveal glass-card p-5 md:p-6">
            <Prose html={pull.bodyHtml} />
          </div>
        )}
        <a
          className="mt-3 inline-block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-200 ease-[var(--ease-out)] hover:text-ember-text"
          href={pull.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open on GitHub ↗
        </a>
      </div>
    </li>
  );
}

function PullGroup({ pulls, title }: { pulls: Pull[]; title: string }) {
  if (pulls.length === 0) {
    return null;
  }
  return (
    <section className="mt-8 first:mt-0">
      <h2 className={groupLabel}>
        {title} · {pulls.length}
      </h2>
      <ul className="glass-card mt-3 px-4 py-1 sm:px-6">
        {pulls.map((pull) => (
          <PullRow key={`${pull.repo}#${pull.number}`} pull={pull} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The GitHub page is a pull request list: open first, then closed and merged.
 * Every count is derived from the pulls themselves; nothing reads a field
 * GitHub no longer sends.
 */
export function GitHubPage() {
  const overview = useQuery(overviewOptions);
  const data = overview.data;
  const pulls = data?.pulls ?? [];
  const open = pulls.filter((pull) => pull.state === "open");
  const closed = pulls.filter((pull) => pull.state !== "open");
  const merged = pulls.filter((pull) => pull.merged).length;

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
            Pull requests from GitHub — read from a cached snapshot rather than
            a live GitHub call.
          </p>
          <p className="mt-3 max-w-[52ch] text-muted">
            The evidence of the work: every change proposed, reviewed and merged
            in the open.
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
          {overview.isPending && (
            <p className={muted}>Loading pull requests…</p>
          )}
          {overview.isError && (
            <p className="font-mono text-[0.75rem] text-ember-text">
              Could not load pull requests.
            </p>
          )}

          {overview.isSuccess && pulls.length > 0 && (
            <p className="font-mono text-[0.75rem] tabular-nums text-muted">
              {pulls.length} pull requests · {merged} merged · {open.length}{" "}
              open
            </p>
          )}

          {overview.isSuccess && pulls.length === 0 && (
            <p className={muted}>No pull requests yet.</p>
          )}

          {pulls.length > 0 && (
            <div className="mt-6">
              <PullGroup pulls={open} title="Open" />
              <PullGroup pulls={closed} title="Closed" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
