import type { postSummarySchema } from "@dasa122/contract";
import { Meta, SourceBadge, Tag } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";
import { formatDate } from "../utils/format";

export type PostSummary = ReturnType<typeof postSummarySchema.parse>;

/**
 * One line of the news feed: source badge, title and tags, then the date and
 * reading time. A row, not a card — the parent supplies the hairline rules.
 *
 * When the post has a slug the title link is stretched over the whole row with
 * an absolutely positioned `::after`, so the fill, the nudge and the arrow are
 * hover states of the thing that actually navigates. A post with no slug but an
 * external URL links there instead (in a new tab); with neither, the row gets
 * no hover affordance at all.
 */
export function PostRow({ post }: { post: PostSummary }) {
  const linkClass =
    "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] after:absolute after:inset-0 after:content-[''] hover:text-ember-text";

  const meta = [formatDate(post.publishedAt), `${post.readTimeMin} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`group row-lift relative -mx-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 rounded-[var(--radius-md)] px-3 py-5 pr-10 sm:gap-x-8${
        post.slug || post.externalUrl
          ? " hover:bg-[var(--color-surface-2)] has-[a:active]:scale-[0.998]"
          : ""
      }`}
    >
      <div className="w-16 shrink-0 sm:w-20">
        <SourceBadge source={post.source} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl leading-snug tracking-[-0.01em] [overflow-wrap:anywhere]">
          {post.slug ? (
            <Link
              className={linkClass}
              params={{ slug: post.slug }}
              to="/news/$slug"
            >
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                {post.title}
              </span>
            </Link>
          ) : post.externalUrl ? (
            <a
              className={linkClass}
              href={post.externalUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                {post.title}
              </span>
            </a>
          ) : (
            post.title
          )}
        </h3>
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>
      {/* A flex-1 sibling never wraps on its own, so the meta is given a full
          line on a phone instead of squeezing the title to a sliver. */}
      <div className="w-full text-right sm:w-auto">
        <Meta>{meta}</Meta>
      </div>
      {(post.slug || post.externalUrl) && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ember-text opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          ↗
        </span>
      )}
    </article>
  );
}
