import type { siteSettingsSchema } from "@dasa122/contract";
import { buttonClassName } from "@dasa122/ui";
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
    <html
      data-palette={settings?.palette ?? "ember"}
      lang="en"
      style={accentStyle(settings?.accent)}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before the first paint: dark is the default, light is opt-in. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const s=localStorage.getItem('theme');const d=s?s==='dark':true;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <div aria-hidden="true" className="scroll-progress" />
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
      <section className="relative isolate w-full overflow-hidden bg-[var(--acc-deep)]">
        <div
          className={`${frame} relative flex min-h-[clamp(24rem,58vh,34rem)] flex-col justify-center py-[clamp(4rem,10vw,7rem)]`}
        >
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-white/80">
            404
          </p>
          <h1 className="mt-5 max-w-[18ch] font-display text-[clamp(2.5rem,8vw,5.5rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white">
            This page does not exist.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-white/85">
            The link may be old, or the page may have moved. The notes and the
            work are still where you left them.
          </p>
          <div className="mt-9">
            <Link className={buttonClassName("quiet")} to="/">
              Back to the front page
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
