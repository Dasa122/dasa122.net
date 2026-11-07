import type { postSourceSchema } from "@dasa122/contract";
import { Button, Rule, Section } from "@dasa122/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { PostRow } from "../../components/post-row";
import { canonicalOrigin } from "../../utils/canonical";
import { orpc } from "../../utils/orpc";

type PostSource = ReturnType<typeof postSourceSchema.parse>;

/** The sources a reader can filter the feed by, labelled for the page. */
export const SOURCES: { value: PostSource; label: string }[] = [
  { label: "Notes", value: "own" },
  { label: "GitHub", value: "github" },
  { label: "LinkedIn", value: "linkedin" },
];

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
const heading = "text-3xl leading-tight tracking-[-0.01em] md:text-4xl";
const filterLink =
  "font-mono text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text";

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

function feedOptions(search: NewsSearch) {
  return orpc.posts.list.infiniteOptions({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: search.cursor ?? null,
    input: (cursor) => ({
      cursor: cursor ?? undefined,
      limit: PAGE_SIZE,
      sources: search.source ? [search.source] : undefined,
      tag: search.tag,
      year: search.year,
    }),
  });
}

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
  loader: ({ context, deps }) =>
    context.queryClient.prefetchInfiniteQuery(feedOptions(deps)),
  loaderDeps: ({ search }) => search,
  validateSearch: parseSearch,
});

function Dot() {
  return (
    <span aria-hidden="true" className="text-rule">
      ·
    </span>
  );
}

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
      aria-current={active ? "true" : undefined}
      className={`${filterLink}${active ? " text-ink" : ""}`}
      search={search}
      to="/news"
    >
      {children}
    </Link>
  );
}

function NewsPage() {
  const search = Route.useSearch();
  const feed = useInfiniteQuery(feedOptions(search));
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <header>
            <h1 className={heading}>News</h1>
            <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-ink">
              Notes, releases, and imported activity — everything published
              here.
            </p>
          </header>

          <nav
            aria-label="Filter the feed"
            className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-2"
          >
            <FilterLink
              active={search.source === undefined}
              search={{ ...search, cursor: undefined, source: undefined }}
            >
              All
            </FilterLink>
            {SOURCES.map((option) => (
              <Fragment key={option.value}>
                <Dot />
                <FilterLink
                  active={search.source === option.value}
                  search={{
                    ...search,
                    cursor: undefined,
                    source: option.value,
                  }}
                >
                  {option.label}
                </FilterLink>
              </Fragment>
            ))}
            {search.tag && (
              <>
                <Dot />
                <FilterLink
                  search={{ ...search, cursor: undefined, tag: undefined }}
                >
                  tagged “{search.tag}” ×
                </FilterLink>
              </>
            )}
            {search.year && (
              <>
                <Dot />
                <FilterLink
                  search={{ ...search, cursor: undefined, year: undefined }}
                >
                  {search.year} ×
                </FilterLink>
              </>
            )}
          </nav>

          <div className="mt-8">
            <Rule />
            {feed.isPending && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Loading notes…
              </p>
            )}
            {feed.isError && (
              <p className="py-5 font-mono text-[0.75rem] text-ember-text">
                Could not load the feed.
              </p>
            )}
            {feed.isSuccess && posts.length === 0 && (
              <p className="py-5 font-mono text-[0.75rem] text-muted">
                Nothing published yet.
              </p>
            )}
            {posts.map((post, index) => (
              <Fragment key={post.id}>
                {index > 0 && <Rule />}
                <PostRow post={post} />
              </Fragment>
            ))}
          </div>

          {feed.hasNextPage && (
            <div className="mt-8">
              <Button
                disabled={feed.isFetchingNextPage}
                onClick={() => feed.fetchNextPage()}
                variant="quiet"
              >
                {feed.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
