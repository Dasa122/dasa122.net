import { env } from "../env";
import { logger } from "../logger";
import {
  OAUTH_COOKIE,
  parseCookies,
  SESSION_COOKIE,
  serializeCookie,
} from "./cookies";
import { verifyIdToken } from "./id-token";
import { buildAuthorizeUrl, discover, exchangeCode } from "./oidc";
import { generateNonce, generatePkce, generateState } from "./pkce";
import {
  createSession,
  hasAdminGroup,
  readSession,
  revokeSession,
  type SessionInput,
  sessionInputFromClaims,
} from "./session";

const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;
const OAUTH_COOKIE_PATH = "/api/auth";
const SESSION_COOKIE_PATH = "/api";
const SESSION_SCOPE = "openid profile email groups";
const SECONDS_PER_DAY = 24 * 60 * 60;

/** Backslashes and control characters can split or re-target `Location`. */
function hasUnsafeCharacter(value: string): boolean {
  if (value.includes("\\")) {
    return true;
  }
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

type OAuthCookiePayload = {
  createdAt: number;
  nonce: string;
  returnTo: string;
  state: string;
  verifier: string;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location });
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(null, { headers, status: 302 });
}

/** Cookies are only marked `Secure` when the public origin is HTTPS. */
function secureCookies(): boolean {
  return env.publicOrigin.startsWith("https://");
}

/**
 * Accepts only a same-origin path: a single leading `/`, no `//` scheme-relative
 * form, no backslash (which URL parsers normalize to `/`) and no control
 * characters that could split the `Location` header.
 */
function safeReturnTo(value: string | null): string {
  if (value === null) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  if (hasUnsafeCharacter(value)) {
    return "/";
  }
  return value;
}

function oauthCookie(payload: OAuthCookiePayload): string {
  return serializeCookie(
    OAUTH_COOKIE,
    encodeURIComponent(JSON.stringify(payload)),
    {
      httpOnly: true,
      maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
      path: OAUTH_COOKIE_PATH,
      sameSite: "Lax",
      secure: secureCookies(),
    },
  );
}

function clearOAuthCookie(): string {
  return serializeCookie(OAUTH_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: OAUTH_COOKIE_PATH,
    sameSite: "Lax",
    secure: secureCookies(),
  });
}

function sessionCookie(sessionId: string): string {
  return serializeCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAge: env.sessionTtlDays * SECONDS_PER_DAY,
    path: SESSION_COOKIE_PATH,
    sameSite: "Lax",
    secure: secureCookies(),
  });
}

function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: SESSION_COOKIE_PATH,
    sameSite: "Lax",
    secure: secureCookies(),
  });
}

function readOAuthCookie(request: Request): OAuthCookiePayload | null {
  const raw = parseCookies(request.headers.get("cookie"))[OAUTH_COOKIE];
  if (raw === undefined) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.state !== "string" ||
    typeof record.nonce !== "string" ||
    typeof record.verifier !== "string"
  ) {
    return null;
  }
  return {
    createdAt: typeof record.createdAt === "number" ? record.createdAt : 0,
    nonce: record.nonce,
    returnTo:
      typeof record.returnTo === "string" ? safeReturnTo(record.returnTo) : "/",
    state: record.state,
    verifier: record.verifier,
  };
}

function callbackUrl(): string {
  return `${env.publicOrigin}/api/auth/callback`;
}

async function handleLogin(url: URL): Promise<Response> {
  if (!env.authentik.isConfigured) {
    return json(503, {
      error: "authentik_not_configured",
      message: "Set AUTHENTIK_CLIENT_ID and AUTHENTIK_CLIENT_SECRET.",
    });
  }

  let discovery: Awaited<ReturnType<typeof discover>>;
  try {
    discovery = await discover(env.authentik.issuer);
  } catch (error) {
    logger.warn({ err: error, event: "auth_login_failed" }, "login rejected");
    return json(502, { error: "token_exchange_failed" });
  }
  const state = generateState();
  const nonce = generateNonce();
  const pkce = generatePkce();
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  const authorizeUrl = buildAuthorizeUrl(discovery, {
    clientId: env.authentik.clientId,
    codeChallenge: pkce.challenge,
    nonce,
    redirectUri: callbackUrl(),
    scope: SESSION_SCOPE,
    state,
  });

  const cookie = oauthCookie({
    createdAt: Date.now(),
    nonce,
    returnTo,
    state,
    verifier: pkce.verifier,
  });
  return redirect(authorizeUrl, [cookie]);
}

async function handleCallback(request: Request, url: URL): Promise<Response> {
  const oauth = readOAuthCookie(request);
  const state = url.searchParams.get("state");
  if (oauth === null || state === null || state !== oauth.state) {
    return json(400, { error: "invalid_state" });
  }

  if (!env.authentik.isConfigured) {
    return json(503, {
      error: "authentik_not_configured",
      message: "Set AUTHENTIK_CLIENT_ID and AUTHENTIK_CLIENT_SECRET.",
    });
  }

  const code = url.searchParams.get("code");
  if (code === null || code === "") {
    return json(400, { error: "token_exchange_failed" });
  }

  let discovery: Awaited<ReturnType<typeof discover>>;
  let idToken: string;
  try {
    discovery = await discover(env.authentik.issuer);
    const tokens = await exchangeCode({
      clientId: env.authentik.clientId,
      clientSecret: env.authentik.clientSecret,
      code,
      codeVerifier: oauth.verifier,
      discovery,
      redirectUri: callbackUrl(),
    });
    idToken = tokens.id_token;
  } catch (error) {
    logger.warn(
      { err: error, event: "auth_callback_failed" },
      "callback rejected",
    );
    return json(502, { error: "token_exchange_failed" });
  }

  let claims: Record<string, unknown>;
  try {
    const verified = await verifyIdToken({
      audience: env.authentik.clientId,
      discovery,
      idToken,
      nonce: oauth.nonce,
    });
    claims = verified as unknown as Record<string, unknown>;
  } catch (error) {
    logger.warn(
      { err: error, event: "auth_callback_failed" },
      "callback rejected",
    );
    return json(401, { error: "id_token_invalid" });
  }

  let input: SessionInput;
  try {
    input = sessionInputFromClaims(claims);
  } catch (error) {
    logger.warn(
      { err: error, event: "auth_callback_failed" },
      "callback rejected",
    );
    return json(401, { error: "id_token_invalid" });
  }

  let sessionId: string;
  try {
    const session = await createSession(input);
    sessionId = session.id;
  } catch (error) {
    logger.error(
      { err: error, event: "auth_session_create_failed" },
      "session creation failed",
    );
    return json(503, { error: "session_unavailable" });
  }

  return redirect(safeReturnTo(oauth.returnTo), [
    sessionCookie(sessionId),
    clearOAuthCookie(),
  ]);
}

async function handleLogout(request: Request): Promise<Response> {
  const id = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (id !== undefined) {
    try {
      await revokeSession(id);
    } catch (error) {
      logger.error(
        { err: error, event: "auth_session_revoke_failed" },
        "session revocation failed",
      );
      return json(503, { error: "session_unavailable" });
    }
  }
  return redirect(env.publicOrigin, [clearSessionCookie()]);
}

async function handleSession(request: Request): Promise<Response> {
  let session: Awaited<ReturnType<typeof readSession>>;
  try {
    session = await readSession(request);
  } catch (error) {
    logger.error(
      { err: error, event: "auth_session_read_failed" },
      "session read failed",
    );
    return json(503, { error: "session_unavailable" });
  }
  if (session === null) {
    return json(401, {
      authenticated: false,
      groups: [],
      isAdmin: false,
    });
  }
  return json(200, {
    authenticated: true,
    groups: session.groups,
    isAdmin: hasAdminGroup(session, env.authentik.adminGroup),
  });
}

/** Dispatches the four Authentik routes; every other auth path is a 404. */
export async function handleAuthRoutes(
  request: Request,
  url: URL,
): Promise<Response> {
  switch (url.pathname) {
    case "/api/auth/login":
      return handleLogin(url);
    case "/api/auth/callback":
      return handleCallback(request, url);
    case "/api/auth/logout":
      return handleLogout(request);
    case "/api/auth/session":
      return handleSession(request);
    default:
      return json(404, { error: "not_found", message: "Not found" });
  }
}
