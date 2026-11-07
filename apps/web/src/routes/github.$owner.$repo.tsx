import { buttonClassName, Meta, Prose, Rule, Section } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { canonicalOrigin } from "../utils/canonical";
import { isNotFound } from "../utils/errors";
import { formatDate, formatNumber } from "../utils/format";
import { type api, orpc } from "../utils/orpc";

type RepoDetail = Awaited<ReturnType<typeof api.github.repo>>;

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const quietLink =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text hover:underline hover:underline-offset-4";
const muted = "font-mono text-[0.75rem] text-muted";

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
    <button className={quietLink} onClick={() => void copy()} type="button">
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

  return (
    <main className="flex-1">
      <div className={frame}>
        <div className="pt-8">
          <Link className={quietLink} to="/github">
            ← GitHub
          </Link>
        </div>

        <article className="pt-[clamp(2rem,5vw,4rem)] pb-[clamp(4rem,10vw,9rem)]">
          {isPending && <p className={muted}>Loading repository…</p>}

          {isError && (
            <div className={muted}>
              <p>Could not load this repository.</p>
              <p className="mt-3">
                <a
                  className="underline underline-offset-4"
                  href={fallbackUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open on GitHub ↗
                </a>
              </p>
            </div>
          )}

          {repo && (
            <>
              <header>
                <h1 className="max-w-[24ch] font-display text-[clamp(2.75rem,7vw,5rem)] leading-[1.02] tracking-[-0.02em]">
                  {repo.name}
                </h1>
                <p className={`${muted} mt-2`}>
                  {repo.owner}/{repo.name}
                </p>

                {repo.description && (
                  <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink">
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

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    className={buttonClassName("solid")}
                    href={repo.htmlUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open on GitHub ↗
                  </a>

                  <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2">
                    <code className="font-mono text-[0.75rem] text-muted">
                      {`git clone https://github.com/${repo.owner}/${repo.name}.git`}
                    </code>
                    <CopyButton
                      text={`git clone https://github.com/${repo.owner}/${repo.name}.git`}
                    />
                  </div>
                </div>
              </header>

              <div className="mt-12">
                {repo.readmeHtml ? (
                  // Sanitised at the API boundary. The image constraints are
                  // scoped here because a wide badge row must not scroll the
                  // page horizontally.
                  <div className="[&_img]:h-auto [&_img]:max-w-full">
                    <Prose html={repo.readmeHtml} />
                  </div>
                ) : (
                  <p className={muted}>This repository has no README.</p>
                )}

                {repo.readmeTruncated && (
                  <p className={`${muted} mt-6`}>
                    README truncated —{" "}
                    <a
                      className="underline underline-offset-4"
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
            </>
          )}
        </article>
      </div>
    </main>
  );
}

function RepoNotFound() {
  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
            404
          </p>
          <div className="mt-4">
            <Rule />
          </div>
          <p className="mt-4 font-mono text-[0.75rem] text-muted">
            That repository does not exist.
          </p>
        </Section>
      </div>
    </main>
  );
}
