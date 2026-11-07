import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        {
          content: "width=device-width, initial-scale=1",
          name: "viewport",
        },
        { title: "Dasa122" },
      ],
    }),
    component: RootComponent,
  },
);

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SiteHeader />
        <Outlet />
        <SiteFooter />
        <Scripts />
      </body>
    </html>
  );
}
