import { Meta, SourceBadge, Tag } from "@dasa122/ui";
import { Link } from "@tanstack/react-router";
import { formatDate } from "../utils/format";
import type { PostSummary } from "./post-row";

/**
 * One note as a card: source and date on top, the title, the excerpt, then the
 * tags. A post with no slug but an external URL opens the original in a new
 * tab; with neither it renders as a plain card with no stretched link,
 * matching `PostRow`.
 */
export function PostCard({ post }: { post: PostSummary }) {
  const date = formatDate(post.publishedAt);

  return (
    <article className="glass-panel group relative flex h-full flex-col gap-3 rounded-[var(--radius-lg)] p-6 transition-[translate,box-shadow] duration-500 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] motion-reduce:hover:translate-y-0">
      {post.slug ? (
        <Link
          aria-label={post.title}
          className="absolute inset-0 z-10 rounded-[var(--radius-lg)]"
          params={{ slug: post.slug }}
          to="/news/$slug"
        />
      ) : (
        post.externalUrl && (
          <a
            className="absolute inset-0 z-10 rounded-[var(--radius-lg)]"
            href={post.externalUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            <span className="sr-only">{post.title}</span>
          </a>
        )
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SourceBadge source={post.source} />
        <Meta>{date}</Meta>
      </div>

      <h3 className="[overflow-wrap:anywhere] text-xl leading-[1.1] tracking-[-0.04em] transition-colors duration-300 ease-[var(--ease-out)] group-hover:text-ember-text">
        {post.title}
      </h3>

      {post.excerpt && (
        <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-muted">
          {post.excerpt}
        </p>
      )}

      {post.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {post.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
    </article>
  );
}
