import { readSession, type SessionRecord } from "../auth/session";
import { type Database, db } from "../database/index";

export type { SessionRecord };

export type ApiContext = {
  db: Database;
  now: Date;
  request: Request;
  session: SessionRecord | null;
};

/**
 * Builds the per-request oRPC context. The session is resolved from the
 * `dasa_session` cookie (or synthesized under `AUTH_DEV_BYPASS`); the database
 * handle is the shared singleton from `database/index.ts`, never a new client.
 */
export async function buildContext(request: Request): Promise<ApiContext> {
  return {
    db,
    now: new Date(),
    request,
    session: await readSession(request),
  };
}
