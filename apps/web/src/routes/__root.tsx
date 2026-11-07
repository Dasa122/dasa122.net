import type { siteSettingsSchema } from "@dasa122/contract";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
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
        <SiteHeader name={name} />
        <Outlet />
        <SiteFooter name={name} />
        <Scripts />
      </body>
    </html>
  );
}
