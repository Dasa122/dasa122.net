import { DataPanel, Meta, Rule, Section, SourceBadge, Tag } from "@dasa122/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarkdownBody } from "../../components/markdown-body";
import { canonicalOrigin } from "../../utils/canonical";
import { formatDate } from "../../utils/format";
import { type api, orpc } from "../../utils/orpc";

type PostDetail = Awaited<ReturnType<typeof api.posts.bySlug>>;

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";
const quietLink =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-ember-text hover:underline hover:underline-offset-4";

/** The API answers a missing, draft, or future post with `NOT_FOUND`. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "NOT_FOUND"
  );
}

function absoluteUrl(value: string): string {
  return /^https?:\/\//.test(value)
    ? value
    : `${canonicalOrigin()}${value.startsWith("/") ? "" : "/"}${value}`;
}

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
  const meta = [formatDate(post.publishedAt), `${post.readTimeMin} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="flex-1">
      <div className={frame}>
        <article className="py-[clamp(3.5rem,9vw,7rem)]">
          <header>
            <SourceBadge source={post.source} />
            <h1 className="mt-4 max-w-[24ch] font-display text-[clamp(2.75rem,7vw,5rem)] leading-[1.02] tracking-[-0.02em]">
              {post.title}
            </h1>
            <div className="mt-5">
              <Meta>{meta}</Meta>
            </div>
          </header>

          <div className="mt-10">
            <MarkdownBody html={post.bodyHtml} />
          </div>

          {post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}

          {(post.prev?.slug || post.next?.slug) && (
            <nav aria-label="More notes" className="mt-16">
              <Rule />
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 pt-5">
                {post.prev?.slug ? (
                  <Link
                    className={quietLink}
                    params={{ slug: post.prev.slug }}
                    to="/news/$slug"
                  >
                    ← {post.prev.title}
                  </Link>
                ) : (
                  <span />
                )}
                {post.next?.slug ? (
                  <Link
                    className={quietLink}
                    params={{ slug: post.next.slug }}
                    to="/news/$slug"
                  >
                    {post.next.title} →
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            </nav>
          )}
        </article>
      </div>
    </main>
  );
}

function PostNotFound() {
  return (
    <main className="flex-1">
      <div className={frame}>
        <Section>
          <DataPanel title="404">
            <p className="font-mono text-[0.75rem] text-muted">
              That note does not exist.
            </p>
          </DataPanel>
        </Section>
      </div>
    </main>
  );
}
