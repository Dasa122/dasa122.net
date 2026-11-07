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
 * carries the language and the counts.
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
    <article className="py-5">
      <h3 className="font-mono text-base leading-snug">
        {target ? (
          <Link
            className="transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text"
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
          className="text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text"
          href={repo.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          ↗
        </a>
      </h3>
      {repo.description && (
        <p className="mt-2 max-w-[60ch] text-muted">{repo.description}</p>
      )}
      <div className="mt-2">
        <Meta>{meta}</Meta>
      </div>
    </article>
  );
}
