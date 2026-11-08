import { buttonClassName, Meta, Prose } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { coverForSlug } from "../components/project-card";
import { canonicalOrigin } from "../utils/canonical";
import { isNotFound } from "../utils/errors";
import { formatDate, formatNumber } from "../utils/format";
import { type api, orpc } from "../utils/orpc";

type RepoDetail = Awaited<ReturnType<typeof api.github.repo>>;

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const muted = "font-mono text-[0.75rem] text-muted";
const barLink =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-300 ease-[var(--ease-out)] hover:text-ember-text";

export const Route = createFileRoute("/github/$owner/$repo")({
  component: RepoPage,
  head: ({ loaderData, params }) => {
    // The router does not infer the loader's return type here, so the runtime
    // data (always the loader's `RepoDetail`) is re-typed for `head`.
    const repo = loaderData as RepoDetail | undefined;
    if (!repo) {
      return { meta: [{ title: "Repository not found — Dasa122" }] };
    }
    const title = `${repo.name} — ${repo.owner} — Dasa122`;
    const url = `${canonicalOrigin()}/github/${params.owner}/${params.repo}`;
    return {
      links: [{ href: url, rel: "canonical" }],
      meta: [
        { title },
        ...(repo.description
          ? [{ content: repo.description, name: "description" }]
          : []),
        { content: title, property: "og:title" },
        ...(repo.description
          ? [{ content: repo.description, property: "og:description" }]
          : []),
        { content: "website", property: "og:type" },
        { content: url, property: "og:url" },
      ],
    };
  },
  loader: async ({ context, params }): Promise<RepoDetail> => {
    try {
      return await context.queryClient.ensureQueryData(
        orpc.github.repo.queryOptions({
          input: { name: params.repo, owner: params.owner },
          retry: (failureCount, error) =>
            !isNotFound(error) && failureCount < 3,
        }),
      );
    } catch (error) {
      if (isNotFound(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  notFoundComponent: RepoNotFound,
});

/** A button that copies the clone command and reports success for a moment.
 * It is a real `<button>`, so it works from the keyboard; a missing or denied
 * clipboard leaves the label unchanged instead of throwing. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Permission denied: copy is a convenience, not the only way to copy.
    }
  }

  return (
    <button
      className="shrink-0 cursor-pointer font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-300 ease-[var(--ease-out)] hover:text-ember-text"
      onClick={() => void copy()}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function RepoPage() {
  const { owner, repo: name } = Route.useParams();
  const {
    data: repo,
    isError,
    isPending,
  } = useQuery(orpc.github.repo.queryOptions({ input: { name, owner } }));

  // Known even before the API answers, so the error state can still offer a way
  // out to GitHub.
  const fallbackUrl = `https://github.com/${owner}/${name}`;
  const clone = `git clone https://github.com/${owner}/${name}.git`;

  return (
    <main className="flex-1">
      {/* The sub-header parks under the site header (both use `--header-h`) and
          carries the same glass and masked blur, so the two read as one piece
          of chrome rather than two stacked bars. */}
      <div className="repo-bar">
        <div className={`${frame} py-3`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link className={barLink} to="/github">
                ← GitHub
              </Link>
              <span aria-hidden="true" className="text-rule">
                /
              </span>
              <span className="min-w-0 font-mono text-[0.75rem] text-ink [overflow-wrap:anywhere]">
                {owner}/{name}
              </span>
            </div>

            <a
              className={`${buttonClassName("quiet")} px-4 py-2`}
              href={repo?.htmlUrl ?? fallbackUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="hidden sm:inline">Open on </span>GitHub ↗
            </a>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
            <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--glass-bg)] px-2.5 py-1 shadow-[inset_0_1px_0_var(--glass-hi),inset_0_0_0_1px_var(--glass-edge)] sm:max-w-[32rem] sm:flex-1">
              <code className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-muted">
                {clone}
              </code>
              <CopyButton text={clone} />
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="repo-bar-blur" />
      </div>

      {isPending && (
        <div className={frame}>
          <p className={`${muted} py-16`}>Loading repository…</p>
        </div>
      )}

      {isError && (
        <div className={frame}>
          <div className="glass-card mt-10 p-6 sm:p-8">
            <p className={muted}>Could not load this repository.</p>
            <p className="mt-4">
              <a
                className={buttonClassName("quiet")}
                href={fallbackUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open on GitHub ↗
              </a>
            </p>
          </div>
        </div>
      )}

      {repo && (
        <>
          {/* The band is the repository's own panel, hashed from its full name,
              so it never changes under the same repository. It is a neutral
              surface, so the title and kicker are ink and muted. */}
          <section
            className="relative isolate overflow-hidden border-b border-[var(--hairline)]"
            style={{ background: coverForSlug(`${owner}/${name}`) }}
          >
            <div
              className={`${frame} relative flex min-h-[clamp(13rem,30vh,20rem)] flex-col justify-end pt-20 pb-[clamp(1.75rem,4vw,3rem)]`}
            >
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
                {repo.owner} · Repository
              </p>
              <h1 className="mt-3 max-w-[24ch] font-display text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-ink [overflow-wrap:anywhere]">
                {repo.name}
              </h1>
            </div>
          </section>

          <div className={frame}>
            <article className="max-w-[62rem] pt-[clamp(2rem,5vw,3.5rem)] pb-[clamp(4rem,10vw,9rem)]">
              {repo.description && (
                <p className="max-w-[62ch] text-lg leading-relaxed text-ink md:text-xl">
                  {repo.description}
                </p>
              )}

              <div className="mt-4">
                <Meta>
                  {[
                    repo.language,
                    `★ ${formatNumber(repo.stars)}`,
                    `⑂ ${formatNumber(repo.forks)}`,
                    `updated ${formatDate(repo.updatedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Meta>
              </div>

              <div className="mt-10">
                {repo.readmeHtml ? (
                  // Sanitised at the API boundary. The image constraints and
                  // the table scroll live in `Prose`, so a wide badge row
                  // cannot scroll the page sideways.
                  <div className="glass-card p-6 md:p-10">
                    <Prose html={repo.readmeHtml} />
                  </div>
                ) : (
                  <div className="glass-card p-6 md:p-8">
                    <p className={muted}>This repository has no README.</p>
                  </div>
                )}

                {repo.readmeTruncated && (
                  <p className={`${muted} mt-6`}>
                    README truncated —{" "}
                    <a
                      className="underline decoration-ember underline-offset-4 hover:decoration-ember-text"
                      href={repo.htmlUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      open it on GitHub for the rest
                    </a>
                    .
                  </p>
                )}
              </div>
            </article>
          </div>
        </>
      )}
    </main>
  );
}

function RepoNotFound() {
  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="py-[clamp(4rem,12vw,8rem)]">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
            404
          </p>
          <p className="mt-5 max-w-[24ch] font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            That repository does not exist.
          </p>
          <Link className={`${buttonClassName("quiet")} mt-8`} to="/github">
            All repositories
          </Link>
        </div>
      </div>
    </main>
  );
}
