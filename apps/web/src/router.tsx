import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";
import "./styles/app.css";

export function getRouter() {
  const queryClient = new QueryClient();
  const router = createTanStackRouter({
    context: { queryClient },
    defaultPreload: "intent",
    // Cross-route navigations run inside `document.startViewTransition` where
    // the browser supports it; the CSS in `app.css` keeps the header still and
    // gives the page a short cross-fade with a small lift. Unsupported
    // browsers ignore the option and navigate normally.
    defaultViewTransition: true,
    routeTree,
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export const router = getRouter();
