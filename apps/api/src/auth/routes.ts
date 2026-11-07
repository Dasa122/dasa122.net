/**
 * Placeholder for the Authentik routes. Every auth path answers 404 until the
 * real login, callback, logout and session handlers land, so the server boots
 * without an auth flow and nothing leaks.
 */
export async function handleAuthRoutes(
  _request: Request,
  _url: URL,
): Promise<Response> {
  return new Response("Not found", { status: 404 });
}
