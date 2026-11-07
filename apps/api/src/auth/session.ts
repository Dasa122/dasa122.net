import { eq } from "drizzle-orm";
import { db } from "../database/index";
import { sessionsTable } from "../database/schema";
import { env } from "../env";
import { parseCookies, SESSION_COOKIE } from "./cookies";
import { base64UrlEncode } from "./pkce";

/** A signed-in user, as stored in the `sessions` table. */
export type SessionRecord = {
  email: string | null;
  expiresAt: Date;
  groups: string[];
  id: string;
  name: string | null;
  subject: string;
};

/** The claims needed to open a session, before the row exists. */
export type SessionInput = {
  email: string | null;
  groups: string[];
  name: string | null;
  subject: string;
};

const SESSION_ID_BYTES = 32;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEV_BYPASS_ID = "dev-bypass";

function randomSessionId(): string {
  return base64UrlEncode(
    globalThis.crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES)),
  );
}

/**
 * Persists a new session with an opaque random id. The id is the only thing the
 * browser ever receives; no JWT or claim is handed out.
 */
export async function createSession(
  input: SessionInput,
  ttlDays: number = env.sessionTtlDays,
): Promise<SessionRecord> {
  const id = randomSessionId();
  const expiresAt = new Date(Date.now() + ttlDays * MS_PER_DAY);
  const [row] = await db
    .insert(sessionsTable)
    .values({
      email: input.email,
      expiresAt,
      groups: input.groups,
      id,
      name: input.name,
      subject: input.subject,
    })
    .returning();
  if (row === undefined) {
    throw new Error("session_insert_failed");
  }
  return row;
}

/** Reads a session by id. A row past its `expiresAt` is treated as absent. */
export async function findSession(id: string): Promise<SessionRecord | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return row;
}

/** Deletes a session. Revoking an unknown id is a no-op. */
export async function revokeSession(id: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
}

/** Exact, case-sensitive membership: no trimming and no substring matching. */
export function hasAdminGroup(
  session: SessionRecord | null,
  adminGroup: string,
): boolean {
  return session !== null && session.groups.includes(adminGroup);
}

/**
 * Normalizes the claims of a verified id_token into session input. The optional
 * claims are unchecked by `verifyIdToken` (`record as IdTokenClaims`), so each
 * one is guarded here: a provider that serializes `groups` as a string would
 * otherwise let `Array.prototype.includes` do a substring match and grant
 * admin to e.g. `"dasa122.net-admin-extra"`.
 */
export function sessionInputFromClaims(
  claims: Record<string, unknown>,
): SessionInput {
  const subject = claims.sub;
  if (typeof subject !== "string" || subject === "") {
    throw new Error("missing_subject");
  }
  return {
    email: typeof claims.email === "string" ? claims.email : null,
    groups: Array.isArray(claims.groups)
      ? claims.groups.filter(
          (group): group is string => typeof group === "string",
        )
      : [],
    name: typeof claims.name === "string" ? claims.name : null,
    subject,
  };
}

/** The synthetic admin session used only when `AUTH_DEV_BYPASS` is enabled. */
export function devBypassSession(): SessionRecord {
  return {
    email: null,
    expiresAt: new Date(Date.now() + 365 * MS_PER_DAY),
    groups: [env.authentik.adminGroup],
    id: DEV_BYPASS_ID,
    name: "Development bypass",
    subject: DEV_BYPASS_ID,
  };
}

/**
 * Resolves the session for a request from the `dasa_session` cookie. Used by
 * both the oRPC context and the auth routes so the dev bypass behaves the same
 * on either path.
 */
export async function readSession(
  request: Request,
): Promise<SessionRecord | null> {
  if (env.authDevBypass) {
    return devBypassSession();
  }
  const id = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (id === undefined) {
    return null;
  }
  return findSession(id);
}
