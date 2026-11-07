import { readSession, type SessionRecord } from "../auth/session";
import { type Database, db } from "../database/index";
import { env } from "../env";
import {
  hasBearerScheme,
  mcpTokenSession,
  parseBearerToken,
} from "./mcp-token";

export type { SessionRecord };

export type ApiContext = {
  db: Database;
  now: Date;
  request: Request;
  session: SessionRecord | null;
};

/**
 * Resolves the session for a request. A bearer token, when present, is
 * authoritative: a matching `MCP_TOKEN` yields the synthetic admin session and
 * anything else yields `null`, so a bad token can never quietly become a
 * cookie or anonymous caller. A header that merely *mentions* the bearer scheme
 * but does not parse is treated the same way. Without a bearer header the
 * `dasa_session` cookie path is untouched.
 */
export async function resolveSession(
  request: Request,
): Promise<SessionRecord | null> {
  const authorization = request.headers.get("authorization");
  if (hasBearerScheme(authorization)) {
    const bearer = parseBearerToken(authorization);
    if (bearer === null) {
      return null;
    }
    return mcpTokenSession(bearer, env.mcpToken, env.authentik.adminGroup);
  }
  return readSession(request);
}

/**
 * Builds the per-request oRPC context. The session is resolved from the bearer
 * token or the `dasa_session` cookie (or synthesized under `AUTH_DEV_BYPASS`);
 * the database handle is the shared singleton from `database/index.ts`, never a
 * new client.
 */
export async function buildContext(request: Request): Promise<ApiContext> {
  return {
    db,
    now: new Date(),
    request,
    session: await resolveSession(request),
  };
}
