import {
  afterAll,
  beforeAll,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

// The callback needs a configured provider and a controllable session write.
// The mocks are registered in `beforeAll` (after every other suite's static
// imports have resolved) and restored in `afterAll`, so they cannot leak into
// the suites that use the real modules.
const env = {
  authentik: {
    adminGroup: "dasa122.net-admin",
    clientId: "client-id",
    clientSecret: "client-secret",
    isConfigured: true,
    issuer: "https://auth.example/application/o/test/",
  },
  publicOrigin: "https://dasa122.net",
  sessionTtlDays: 30,
};

let verificationFails = false;
let sessionFails = false;
let discoveryFails = false;
let handleAuthRoutes!: typeof import("./routes").handleAuthRoutes;

beforeAll(async () => {
  mock.module("../env", () => ({ env }));

  mock.module("./oidc", () => ({
    buildAuthorizeUrl: (
      discovery: { authorization_endpoint: string },
      params: { state: string },
    ) => `${discovery.authorization_endpoint}?state=${params.state}`,
    discover: async () => {
      if (discoveryFails) {
        throw new Error("discovery_failed");
      }
      return {
        authorization_endpoint: "https://auth.example/authorize",
        issuer: "https://auth.example/application/o/test/",
        jwks_uri: "https://auth.example/jwks",
        token_endpoint: "https://auth.example/token",
      };
    },
    exchangeCode: async () => ({
      access_token: "access-token",
      id_token: "fake.jwt.token",
      token_type: "Bearer",
    }),
  }));

  mock.module("./id-token", () => ({
    verifyIdToken: async () => {
      if (verificationFails) {
        throw new Error("nonce_mismatch");
      }
      return {
        aud: "client-id",
        exp: 9_999_999_999,
        iss: "https://auth.example/application/o/test/",
        sub: "user-1",
      };
    },
  }));

  mock.module("./session", () => ({
    createSession: async (input: Record<string, unknown>) => {
      if (sessionFails) {
        throw new Error("connection refused");
      }
      return { ...input, expiresAt: new Date(), id: "session-id" };
    },
    hasAdminGroup: () => false,
    readSession: async () => null,
    revokeSession: async () => undefined,
    sessionInputFromClaims: () => ({
      email: null,
      groups: [],
      name: null,
      subject: "user-1",
    }),
  }));

  ({ handleAuthRoutes } = await import("./routes"));
});

afterAll(() => {
  mock.restore();
});

/** Calls the router with stdout captured, so log lines never pollute output. */
async function call(
  url: URL,
  cookie?: string,
): Promise<{ lines: string[]; response: Response }> {
  const spy = spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    const response = await handleAuthRoutes(
      new Request(
        url,
        cookie === undefined ? undefined : { headers: { cookie } },
      ),
      url,
    );
    return {
      lines: spy.mock.calls.map((callArgs) => String(callArgs[0])),
      response,
    };
  } finally {
    spy.mockRestore();
  }
}

async function login(): Promise<{ cookie: string; state: string }> {
  const url = new URL("https://dasa122.net/api/auth/login");
  const { response } = await call(url);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/dasa_oauth=([^;]+)/);
  const location = new URL(
    response.headers.get("location") ?? "https://invalid/",
  );
  if (match === null) {
    throw new Error("missing oauth cookie");
  }
  return {
    cookie: `dasa_oauth=${match[1]}`,
    state: location.searchParams.get("state") ?? "",
  };
}

function callbackUrl(state: string): URL {
  const url = new URL("https://dasa122.net/api/auth/callback");
  url.searchParams.set("code", "auth-code");
  url.searchParams.set("state", state);
  return url;
}

describe("handleAuthRoutes callback failures", () => {
  test("a discovery failure on login is 502 token_exchange_failed", async () => {
    discoveryFails = true;
    try {
      const { response, lines } = await call(
        new URL("https://dasa122.net/api/auth/login"),
      );

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "token_exchange_failed" });
      expect(lines.join("\n")).toContain("auth_login_failed");
    } finally {
      discoveryFails = false;
    }
  });

  test("a session write failure is 503 session_unavailable", async () => {
    sessionFails = true;
    verificationFails = false;
    const { cookie, state } = await login();
    const { response, lines } = await call(callbackUrl(state), cookie);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "session_unavailable" });
    expect(lines.join("\n")).toContain("auth_session_create_failed");
  });

  test("a verification failure stays 401 id_token_invalid", async () => {
    sessionFails = false;
    verificationFails = true;
    const { cookie, state } = await login();
    const { response, lines } = await call(callbackUrl(state), cookie);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "id_token_invalid" });
    expect(lines.join("\n")).toContain("auth_callback_failed");
  });
});
