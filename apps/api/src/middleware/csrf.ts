import { ORPCError } from "@orpc/server";

/**
 * Rejects state-changing cross-origin requests. A missing `Origin` header is
 * allowed (non-browser clients such as curl omit it); a present but different
 * origin is refused.
 */
export function assertSameOrigin(request: Request, publicOrigin: string): void {
  if (
    request.method === "GET" ||
    request.method === "HEAD" ||
    request.method === "OPTIONS"
  ) {
    return;
  }
  const origin = request.headers.get("origin");
  if (origin === null) return;
  if (origin !== publicOrigin) {
    throw new ORPCError("FORBIDDEN", {
      message: "Cross-origin request rejected",
    });
  }
}
