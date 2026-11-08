import type { githubRepoSchema } from "@dasa122/contract";
import { Meta } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";
import { formatNumber } from "../utils/format";

export type Repo = ReturnType<typeof githubRepoSchema.parse>;

/**
 * The `{ owner, name }` pair the in-site repo route needs, derived from the
 * repository's GitHub URL. Anything that is not a `github.com/{owner}/{repo}`
 * URL returns `null`, so the caller can fall back to plain text.
 */
export function parseRepoUrl(
  url: string,
): { name: string; owner: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.hostname !== "github.com" &&
    parsed.hostname !== "www.github.com"
  ) {
    return null;
  }

  const segments = parsed.pathname.split("/").filter((part) => part !== "");
  if (segments.length !== 2) {
    return null;
  }
  const owner = segments[0];
  const rawName = segments[1];
  if (owner === undefined || rawName === undefined) {
    return null;
  }
  const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;
  return name === "" ? null : { name, owner };
}

/**
 * One repository: the name links to the in-site page, a trailing `↗` keeps
 * direct access to GitHub, the description sits beneath it, and a mono meta run
 * carries the language and the counts. It is a row inside the repositories
 * card, not a card of its own, so the list keeps the work index's card rhythm
 * without nesting glass inside glass.
 */
export function RepoRow({ repo }: { repo: Repo }) {
  const target = parseRepoUrl(repo.url);
  const meta = [
    repo.language,
    `★ ${formatNumber(repo.stars)}`,
    `⑂ ${formatNumber(repo.forks)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group -mx-2 flex flex-col gap-1.5 rounded-[var(--radius-md)] px-2 py-4 transition-colors duration-300 ease-[var(--ease-out)] hover:bg-[var(--color-surface-2)]">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-lg leading-snug tracking-[-0.02em] [overflow-wrap:anywhere]">
        {target ? (
          <Link
            className="transition-colors duration-300 ease-[var(--ease-out)] hover:text-ember-text"
            params={{ owner: target.owner, repo: target.name }}
            to="/github/$owner/$repo"
          >
            {repo.name}
          </Link>
        ) : (
          <span>{repo.name}</span>
        )}{" "}
        <a
          aria-label={`${repo.name} on GitHub`}
          className="font-mono text-[0.75rem] text-muted transition-colors duration-300 ease-[var(--ease-out)] hover:text-ember-text"
          href={repo.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          ↗
        </a>
      </h3>
      {repo.description && (
        <p className="max-w-[64ch] text-[0.9375rem] leading-relaxed text-muted">
          {repo.description}
        </p>
      )}
      <div className="mt-0.5">
        <Meta>{meta}</Meta>
      </div>
    </article>
  );
}
