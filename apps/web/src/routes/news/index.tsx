import type { postSourceSchema } from "@dasa122/contract";
import { Button, Meta, SourceBadge, Tag } from "@dasa122/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PostCard } from "../../components/post-card";
import type { PostSummary } from "../../components/post-row";
import { SectionHeading } from "../../components/section-heading";
import { canonicalOrigin } from "../../utils/canonical";
import { formatDate } from "../../utils/format";
import { orpc } from "../../utils/orpc";

type PostSource = ReturnType<typeof postSourceSchema.parse>;

/** The sources a reader can filter the feed by, labelled for the page. */
export const SOURCES: { value: PostSource; label: string }[] = [
  { label: "Notes", value: "own" },
  { label: "GitHub", value: "github" },
  { label: "LinkedIn", value: "linkedin" },
];

/** The sources the feed shows when settings are unavailable. */
const DEFAULT_SOURCES: PostSource[] = SOURCES.map((option) => option.value);

type NewsSearch = {
  cursor?: string;
  source?: PostSource;
  tag?: string;
  year?: number;
};

const PAGE_SIZE = 20;
const TITLE = "News — Dasa122";
const DESCRIPTION =
  "Notes, releases, and imported activity — everything published on Dasa122.";

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const skeleton =
  "animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-2)]";

/** The filter pills. Inactive pills are glass; the active one is the solid
 * accent fill. */
const pill =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--radius-pill)] border px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-[background-color,border-color,color,box-shadow,scale] duration-300 ease-[var(--ease-out)]";
const pillActive = "border-transparent bg-ember-fill text-on-accent";
const pillIdle =
  "border-[var(--glass-edge)] bg-[var(--glass-bg)] text-muted shadow-[inset_0_1px_0_var(--glass-hi)] hover:bg-[var(--glass-bg-hover)] hover:text-ink";

function parseSearch(search: Record<string, unknown>): NewsSearch {
  const source = SOURCES.some((option) => option.value === search.source)
    ? (search.source as PostSource)
    : undefined;
  const tag =
    typeof search.tag === "string" && search.tag.length > 0
      ? search.tag
      : undefined;
  const cursor =
    typeof search.cursor === "string" && search.cursor.length > 0
      ? search.cursor
      : undefined;
  const year = Number(search.year);
  return {
    cursor,
    source,
    tag,
    year:
      Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined,
  };
}

function feedOptions(search: NewsSearch, enabledSources: PostSource[]) {
  return orpc.posts.list.infiniteOptions({
    // An explicitly empty source set means "no sources", not "all sources".
    enabled: enabledSources.length > 0,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    initialPageParam: search.cursor ?? null,
    input: (cursor) => ({
      cursor: cursor ?? undefined,
      limit: PAGE_SIZE,
      sources: search.source !== undefined ? [search.source] : enabledSources,
      tag: search.tag,
      year: search.year,
    }),
  });
}

const siteOptions = orpc.site.get.queryOptions({ input: {} });

export const Route = createFileRoute("/news/")({
  component: NewsPage,
  head: () => {
    const canonical = `${canonicalOrigin()}/news`;
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
  loader: async ({ context, deps }) => {
    let enabledSources = DEFAULT_SOURCES;
    try {
      const settings = await context.queryClient.ensureQueryData(siteOptions);
      enabledSources = settings.enabledSources;
    } catch {
      // A settings outage degrades the source filter, not the page.
    }
    await context.queryClient.prefetchInfiniteQuery(
      feedOptions(deps, enabledSources),
    );
  },
  loaderDeps: ({ search }) => search,
  validateSearch: parseSearch,
});

/**
 * One filter as a link. The search params stay in the URL: the pills navigate,
 * they do not hold client state, so the page is still server-rendered and a
 * filtered feed is still a shareable address.
 */
function FilterLink({
  active = false,
  children,
  search,
}: {
  active?: boolean;
  children: ReactNode;
  search: NewsSearch;
}) {
  return (
    <Link
      // Search is part of the filter, so the router's own active state must
      // consider it; otherwise every pill on a filtered URL claims to be the
      // current page alongside the one that actually is.
      activeOptions={{ exact: true, includeSearch: true }}
      aria-current={active ? "page" : undefined}
      className={`${pill} ${active ? pillActive : pillIdle}`}
      search={search}
      to="/news"
    >
      {children}
    </Link>
  );
}

/**
 * The list half of the feed: a glass row rather than a hairline. The title link
 * is stretched over the whole row, so the row is the hit area.
 */
function FeedRow({ post }: { post: PostSummary }) {
  const meta = [formatDate(post.publishedAt), `${post.readTimeMin} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="glass-panel group relative flex flex-col gap-2.5 rounded-[var(--radius-md)] p-5 transition-[translate,box-shadow] duration-500 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] motion-reduce:hover:translate-y-0 sm:p-6">
      {post.slug && (
        <Link
          aria-label={post.title}
          className="absolute inset-0 z-10 rounded-[var(--radius-md)]"
          params={{ slug: post.slug }}
          to="/news/$slug"
        />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SourceBadge source={post.source} />
        <Meta>{meta}</Meta>
      </div>

      <h3 className="[overflow-wrap:anywhere] text-xl leading-[1.15] tracking-[-0.03em] transition-colors duration-300 ease-[var(--ease-out)] group-hover:text-ember-text">
        {post.title}
      </h3>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
    </article>
  );
}

/** Three cards and four rows of nothing, at the feed's own proportions. */
function FeedSkeleton() {
  return (
    <div aria-busy="true" className="mt-10">
      <span className="sr-only">Loading notes…</span>
      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 md:grid-cols-3"
      >
        {[0, 1, 2].map((key) => (
          <div className={`${skeleton} h-44`} key={key} />
        ))}
      </div>
      <div aria-hidden="true" className="mt-6 grid gap-3">
        {[0, 1, 2, 3].map((key) => (
          <div className={`${skeleton} h-24`} key={key} />
        ))}
      </div>
    </div>
  );
}

function NewsPage() {
  const search = Route.useSearch();
  const site = useQuery(siteOptions);
  const enabledSources = site.data?.enabledSources ?? DEFAULT_SOURCES;
  const feed = useInfiniteQuery(feedOptions(search, enabledSources));
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const feedHidden = enabledSources.length === 0;

  const filtered =
    search.source !== undefined ||
    search.tag !== undefined ||
    search.year !== undefined;

  // The first three notes are cards, the rest is the list — the same split the
  // home page uses.
  const cards = posts.slice(0, 3);
  const rest = posts.slice(3);
  const empty = posts.length === 0 && (feed.isSuccess || feedHidden);

  return (
    <main className="flex-1">
      <div className={`${frame} pt-[clamp(2.5rem,6vw,4.5rem)] pb-8`}>
        <header>
          <SectionHeading as="h1" label="Journal" title="News" />
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted">
            Notes, releases, and imported activity — everything published here.
          </p>
        </header>
      </div>

      {/* The filter bar is its own sticky surface, so it spans the page rather
          than the frame; the pills sit on the site's gutter inside it. */}
      <div className="feed-bar">
        <div className={`${frame} feed-scroll`}>
          <nav aria-label="Filter the feed" className="flex w-max gap-2 py-3">
            <FilterLink
              active={search.source === undefined}
              search={{ ...search, cursor: undefined, source: undefined }}
            >
              All
            </FilterLink>
            {SOURCES.map((option) => (
              <FilterLink
                active={search.source === option.value}
                key={option.value}
                search={{
                  ...search,
                  cursor: undefined,
                  source: option.value,
                }}
              >
                {option.label}
              </FilterLink>
            ))}
            {search.tag && (
              <FilterLink
                search={{ ...search, cursor: undefined, tag: undefined }}
              >
                tagged “{search.tag}” ×
              </FilterLink>
            )}
            {search.year && (
              <FilterLink
                search={{ ...search, cursor: undefined, year: undefined }}
              >
                {search.year} ×
              </FilterLink>
            )}
          </nav>
        </div>
        <div aria-hidden="true" className="feed-bar-blur" />
      </div>

      <div className={`${frame} pb-[clamp(4rem,10vw,9rem)]`}>
        {feed.isPending && !feedHidden && <FeedSkeleton />}

        {feed.isError && posts.length === 0 && (
          <div className="glass-panel mt-10 flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] p-6">
            <p className="font-mono text-[0.75rem] text-ember-text">
              Could not load the feed.
            </p>
            <Button onClick={() => feed.refetch()} variant="quiet">
              Try again
            </Button>
          </div>
        )}

        {empty && (
          <p className="mt-10 font-mono text-[0.75rem] text-muted">
            {filtered
              ? "No notes match that filter."
              : "Nothing published yet."}
          </p>
        )}

        {cards.length > 0 && (
          <div className="reveal mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {cards.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <ul className="mt-6 grid gap-3">
            {rest.map((post) => (
              <li key={post.id}>
                <FeedRow post={post} />
              </li>
            ))}
          </ul>
        )}

        {feed.isFetchNextPageError && (
          <p className="mt-8 font-mono text-[0.75rem] text-ember-text">
            Could not load more notes.
          </p>
        )}

        {feed.hasNextPage && (
          <div className="mt-10 flex justify-center">
            <Button
              disabled={feed.isFetchingNextPage}
              onClick={() => feed.fetchNextPage()}
              variant="quiet"
            >
              {feed.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
