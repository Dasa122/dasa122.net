import { createFileRoute } from "@tanstack/react-router";

export async function healthzHandler(): Promise<Response> {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: healthzHandler,
    },
  },
});
