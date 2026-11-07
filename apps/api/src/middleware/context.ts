import { type Database, db } from "../database/index";

/** A signed-in user, as stored in the `sessions` table. */
export type SessionRecord = {
  email: string | null;
  expiresAt: Date;
  groups: string[];
  id: string;
  name: string | null;
  subject: string;
};

export type ApiContext = {
  db: Database;
  now: Date;
  request: Request;
  session: SessionRecord | null;
};

/**
 * Builds the per-request oRPC context. The session is always `null` until the
 * auth routes land; the database handle is the shared singleton from
 * `database/index.ts`, never a new client.
 */
export async function buildContext(request: Request): Promise<ApiContext> {
  return { db, now: new Date(), request, session: null };
}
