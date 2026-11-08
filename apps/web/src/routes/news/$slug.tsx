import { buttonClassName, Meta, SourceBadge, Tag } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarkdownBody } from "../../components/markdown-body";
import { PostCard } from "../../components/post-card";
import type { PostSummary } from "../../components/post-row";
import { absoluteUrl, canonicalOrigin } from "../../utils/canonical";
import { isNotFound } from "../../utils/errors";
import { formatDate } from "../../utils/format";
import { type api, orpc } from "../../utils/orpc";

type PostDetail = Awaited<ReturnType<typeof api.posts.bySlug>>;

// The reading column: one measure for the header block and the body. The
// `Prose` component caps the body itself at 68ch; this wrapper keeps the
// title, the meta row and the rule on the same left edge as the prose.
const reading = "mx-auto w-full max-w-[72ch] px-6 md:px-10";

export const Route = createFileRoute("/news/$slug")({
  component: PostPage,
  head: ({ loaderData, params }) => {
    // The router does not infer the loader's return type here, so the runtime
    // data (always the loader's `PostDetail`) is re-typed for `head`.
    const post = loaderData as PostDetail | undefined;
    if (!post) {
      return { meta: [{ title: "Note not found — Dasa122" }] };
    }
    const url = `${canonicalOrigin()}/news/${params.slug}`;
    const description = post.excerpt;
    return {
      links: [{ href: url, rel: "canonical" }],
      meta: [
        { title: post.title },
        ...(description ? [{ content: description, name: "description" }] : []),
        { content: post.title, property: "og:title" },
        ...(description
          ? [{ content: description, property: "og:description" }]
          : []),
        { content: "article", property: "og:type" },
        { content: url, property: "og:url" },
        ...(post.coverImage
          ? [{ content: absoluteUrl(post.coverImage), property: "og:image" }]
          : []),
      ],
    };
  },
  loader: async ({ context, params }): Promise<PostDetail> => {
    try {
      return await context.queryClient.ensureQueryData(
        orpc.posts.bySlug.queryOptions({
          input: { slug: params.slug },
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
  notFoundComponent: PostNotFound,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data: post } = useQuery(
    orpc.posts.bySlug.queryOptions({ input: { slug } }),
  );
  if (!post) {
    return null;
  }
  const published = post.publishedAt ? new Date(post.publishedAt) : null;
  const publishedYear =
    published && !Number.isNaN(published.getTime())
      ? published.getUTCFullYear()
      : null;
  const date = formatDate(post.publishedAt);

  // Whatever the route already fetched: the post's two neighbours. They are
  // full summaries, so they render as the same cards the feed uses — no extra
  // request for a "related" list.
  const related = [post.prev, post.next].filter(
    (item): item is PostSummary => item !== null && item.slug !== null,
  );

  return (
    <main className="flex-1">
      {/* The reading progress line is CSS-only: `animation-timeline` reads the
          document scroll, so nothing here listens to scroll events. */}
      <div aria-hidden="true" className="read-progress" />

      <article
        className={`${reading} pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(3rem,7vw,5rem)]`}
      >
        <header>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <SourceBadge source={post.source} />
            <Meta>
              {date &&
                (publishedYear ? (
                  <Link
                    className="transition-colors duration-300 ease-[var(--ease-out)] hover:text-ember-text hover:underline hover:underline-offset-4"
                    search={{ year: publishedYear }}
                    to="/news"
                  >
                    {date}
                  </Link>
                ) : (
                  date
                ))}
              {date && " · "}
              {post.readTimeMin} min
            </Meta>
            {post.tags.map((tag) => (
              <Link
                className="rounded-[var(--radius-pill)] focus-visible:outline-offset-2"
                key={tag}
                search={{ tag }}
                to="/news"
              >
                <Tag>{tag}</Tag>
              </Link>
            ))}
          </div>

          <h1 className="mt-7 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-[600] leading-[0.98] tracking-[-0.04em] [overflow-wrap:anywhere]">
            {post.title}
          </h1>

          {/* A thin accent rule closes the header block instead of the old
              full-width hairline: it points into the body. */}
          <div
            aria-hidden="true"
            className="mt-8 h-px bg-[var(--acc)] opacity-40"
          />
        </header>

        <div className="mt-12">
          <MarkdownBody html={post.bodyHtml} />
        </div>
      </article>

      {related.length > 0 && (
        <nav
          aria-label="More notes"
          className={`${reading} pb-[clamp(4rem,10vw,9rem)]`}
        >
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
            More notes
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}

function PostNotFound() {
  return (
    <main className="flex-1">
      <div className={reading}>
        <div className="py-[clamp(4rem,12vw,8rem)]">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted">
            404
          </p>
          <p className="mt-5 font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            That note does not exist.
          </p>
          <Link className={`${buttonClassName("quiet")} mt-8`} to="/news">
            All notes
          </Link>
        </div>
      </div>
    </main>
  );
}
