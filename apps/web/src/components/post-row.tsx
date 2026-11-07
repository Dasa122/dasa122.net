import type { postSummarySchema } from "@dasa122/contract";
import { Meta, SourceBadge, Tag } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";
import { formatDate } from "../utils/format";

export type PostSummary = ReturnType<typeof postSummarySchema.parse>;

/**
 * One line of the news feed: source badge, title and tags, then the date and
 * reading time. A row, not a card — the parent supplies the hairline rules.
 */
export function PostRow({ post }: { post: PostSummary }) {
  const className =
    "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text";
  const title = post.slug ? (
    <Link className={className} params={{ slug: post.slug }} to="/news/$slug">
      {post.title}
    </Link>
  ) : (
    post.title
  );

  const meta = [formatDate(post.publishedAt), `${post.readTimeMin} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group relative -mx-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-[var(--radius-md)] px-3 py-5 pr-10 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[var(--color-surface-2)] active:scale-[0.998]">
      <div className="w-20 shrink-0">
        <SourceBadge source={post.source} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl leading-snug tracking-[-0.01em] transition-transform duration-200 group-hover:translate-x-1 md:text-2xl">
          {title}
        </h3>
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>
      <Meta>{meta}</Meta>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ember-text opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        ↗
      </span>
    </article>
  );
}
