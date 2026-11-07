import { describe, expect, mock, test } from "bun:test";

// `context.ts` pulls in `env.ts` (validated at module load) and the shared
// database handle, so give the process a valid bag before the import.
process.env.AUTH_DEV_BYPASS = "false";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/dasa122_net";
process.env.PUBLIC_ORIGIN ??= "https://dasa122.net";
process.env.AUTHENTIK_ISSUER ??= "https://auth.dasa122.net/application/o/demo/";

const cookieSession = {
  email: "owner@dasa122.net",
  expiresAt: new Date(Date.now() + 60_000),
  groups: ["dasa122.net-admin"],
  id: "cookie-session",
  name: "Cookie owner",
  subject: "cookie-owner",
};

const readSession = mock(async () => cookieSession);
mock.module("../auth/session", () => ({ readSession }));

const { resolveSession } = await import("./context");

describe("resolveSession", () => {
  test("a valid cookie still resolves through readSession", async () => {
    readSession.mockClear();

    const session = await resolveSession(
      new Request("https://dasa122.net/api/rpc", {
        headers: { cookie: "dasa_session=abc" },
      }),
    );

    expect(session).toBe(cookieSession);
    expect(readSession).toHaveBeenCalledTimes(1);
  });

  test("a bearer header does not fall back to the cookie", async () => {
    readSession.mockClear();

    const session = await resolveSession(
      new Request("https://dasa122.net/api/rpc", {
        headers: {
          authorization: "Bearer wrong-token",
          cookie: "dasa_session=abc",
        },
      }),
    );

    expect(session).toBeNull();
    expect(readSession).not.toHaveBeenCalled();
  });

  test("a malformed bearer does not fall back to the cookie", async () => {
    readSession.mockClear();

    const session = await resolveSession(
      new Request("https://dasa122.net/api/rpc", {
        headers: {
          authorization: "Bearer a b",
          cookie: "dasa_session=abc",
        },
      }),
    );

    expect(session).toBeNull();
    expect(readSession).not.toHaveBeenCalled();
  });
});
