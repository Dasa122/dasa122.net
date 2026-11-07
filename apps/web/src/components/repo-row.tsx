import type { githubRepoSchema } from "@dasa122/contract";
import { Meta } from "@dasa122/ui";
import { formatNumber } from "../utils/format";

export type Repo = ReturnType<typeof githubRepoSchema.parse>;

/**
 * One repository: the name as an outbound link, the description beneath it,
 * and a mono meta run with the language and the counts.
 */
export function RepoRow({ repo }: { repo: Repo }) {
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
        <a
          className="transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text"
          href={repo.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {repo.name}
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
