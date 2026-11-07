import { ORPCError } from "@orpc/server";
import { hasAdminGroup, type SessionRecord } from "../auth/session";
import { env } from "../env";
import type { ApiContext } from "./context";

/** Requires a signed-in user. */
export async function requireSession(
  context: ApiContext,
): Promise<SessionRecord> {
  if (!context.session) {
    throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
  }
  return context.session;
}

/** Requires a signed-in user whose groups contain the admin group. */
export async function requireAdmin(
  context: ApiContext,
): Promise<SessionRecord> {
  const session = await requireSession(context);
  if (!hasAdminGroup(session, env.authentik.adminGroup)) {
    throw new ORPCError("FORBIDDEN", { message: "Admin group required" });
  }
  return session;
}
