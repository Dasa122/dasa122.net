import type { siteSettingsSchema } from "@dasa122/contract";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { absoluteUrl } from "../utils/canonical";
import { orpc } from "../utils/orpc";
import { accentStyle } from "../utils/theme";

type Settings = ReturnType<typeof siteSettingsSchema.parse>;

const siteOptions = orpc.site.get.queryOptions({ input: {} });

const frame = "mx-auto w-full max-w-[80rem] px-6 md:px-10";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    loader: async ({ context }) => {
      try {
        return await context.queryClient.ensureQueryData(siteOptions);
      } catch {
        return null;
      }
    },
    head: ({ loaderData }) => {
      const ogImage = loaderData?.ogImage
        ? absoluteUrl(loaderData.ogImage)
        : null;
      return {
        links: [{ href: "/favicon.svg", rel: "icon", type: "image/svg+xml" }],
        meta: [
          { charSet: "utf-8" },
          {
            content: "width=device-width, initial-scale=1",
            name: "viewport",
          },
          { title: "Dasa122" },
          ...(ogImage ? [{ content: ogImage, property: "og:image" }] : []),
        ],
      };
    },
    component: RootComponent,
    notFoundComponent: NotFound,
  },
);

function RootComponent() {
  const settings = Route.useLoaderData() as Settings | null;
  const name = settings?.name.trim() || "Dasa122";

  return (
    <html lang="en" style={accentStyle(settings?.accent)}>
      <head>
        <HeadContent />
      </head>
      <body>
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:border focus:border-rule focus:bg-paper focus:px-4 focus:py-2 focus:font-mono focus:text-[0.75rem] focus:text-ink"
          href="#main"
        >
          Skip to content
        </a>
        <SiteHeader name={name} />
        <div
          className="flex flex-1 flex-col scroll-mt-24"
          id="main"
          tabIndex={-1}
        >
          <Outlet />
        </div>
        <SiteFooter name={name} />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="flex flex-1 items-center">
      <div className={`${frame} py-24`}>
        <p
          aria-hidden="true"
          className="font-display text-[clamp(6rem,22vw,14rem)] leading-[0.8] text-rule"
        >
          404
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
          That page does not exist.
        </h1>
        <p className="mt-3 max-w-[42ch] text-muted">
          The link may be old, or the page may have moved. The notes and the
          work are still where you left them.
        </p>
        <Link
          className="mt-8 inline-block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ember-text transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:underline hover:underline-offset-4"
          to="/"
        >
          Back to the front page
        </Link>
      </div>
    </main>
  );
}
