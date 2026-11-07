/**
 * Authentik OIDC discovery, authorization URL construction and code exchange.
 * Every network call accepts an injectable `fetchImpl` so the module is
 * unit-testable without a real provider.
 */

export type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
  jwks_uri: string;
};

export type TokenResponse = {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
};

const MAX_ERROR_BODY_BYTES = 4096;
const MAX_ERROR_CODE_LENGTH = 64;
const MAX_ERROR_DESCRIPTION_LENGTH = 200;
const LAST_C0_CODE_POINT = 0x1f;
const DELETE_CODE_POINT = 0x7f;
const LAST_C1_CODE_POINT = 0x9f;

export async function discover(
  issuer: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<OidcDiscovery> {
  const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error("discovery_failed");
  }
  return (await response.json()) as OidcDiscovery;
}

export function buildAuthorizeUrl(
  discovery: OidcDiscovery,
  params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    nonce: string;
    codeChallenge: string;
  },
): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    nonce: params.nonce,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scope,
    state: params.state,
  });
  return `${discovery.authorization_endpoint}?${query.toString()}`;
}

function basicAuth(clientId: string, clientSecret: string): string {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

/** Reads at most `limit` bytes of a response body and decodes them as UTF-8. */
async function readLimitedText(
  response: Response,
  limit: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const take =
        value.length > limit - total ? value.subarray(0, limit - total) : value;
      total += take.length;
      text += decoder.decode(take, { stream: true });
      if (total >= limit) {
        break;
      }
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text;
}

function isControlCodePoint(code: number): boolean {
  return (
    code <= LAST_C0_CODE_POINT ||
    (code >= DELETE_CODE_POINT && code <= LAST_C1_CODE_POINT)
  );
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (!isControlCodePoint(code)) {
      result += character;
    }
  }
  return result;
}

function sanitizeErrorText(value: string, limit: number): string {
  return stripControlCharacters(value).slice(0, limit);
}

/**
 * Reduces a provider error body to a short, control-character-free
 * `{ error, errorDescription }` pair. A non-JSON body is `unknown_error`.
 */
export function parseTokenErrorBody(body: string): {
  error: string;
  errorDescription: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { error: "unknown_error", errorDescription: null };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: "unknown_error", errorDescription: null };
  }
  const record = parsed as Record<string, unknown>;
  const rawError = record.error;
  const rawDescription = record.error_description;
  return {
    error:
      typeof rawError === "string"
        ? sanitizeErrorText(rawError, MAX_ERROR_CODE_LENGTH)
        : "unknown_error",
    errorDescription:
      typeof rawDescription === "string"
        ? sanitizeErrorText(rawDescription, MAX_ERROR_DESCRIPTION_LENGTH)
        : null,
  };
}

export async function exchangeCode(args: {
  discovery: OidcDiscovery;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  const body = new URLSearchParams({
    client_id: args.clientId,
    code: args.code,
    code_verifier: args.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
  });
  const response = await fetchImpl(args.discovery.token_endpoint, {
    body,
    headers: {
      Authorization: basicAuth(args.clientId, args.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = await readLimitedText(response, MAX_ERROR_BODY_BYTES);
    const parsed = parseTokenErrorBody(errorBody);
    throw new Error(`token_exchange_failed: ${parsed.error}`);
  }

  const tokens = (await response.json()) as TokenResponse;
  if (!tokens.id_token) {
    throw new Error("missing_id_token");
  }
  return tokens;
}
