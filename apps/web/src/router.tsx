import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/instrument-serif/400.css";
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
    routeTree,
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export const router = getRouter();
