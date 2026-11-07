import { describe, expect, test } from "bun:test";

// `env.ts` evaluates `parseEnv(process.env)` at module load, so give the
// process a valid bag before the module is imported and keep the suite
// independent of whatever happens to be set in the shell.
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/dasa122_net";
process.env.PUBLIC_ORIGIN ??= "https://dasa122.net";
process.env.AUTHENTIK_ISSUER ??= "https://auth.dasa122.net/application/o/demo/";

const { parseEnv } = await import("./env");

describe("parseEnv", () => {
  test("boots with empty Authentik credentials", () => {
    const env = parseEnv({
      AUTHENTIK_CLIENT_ID: "",
      AUTHENTIK_CLIENT_SECRET: "",
      AUTHENTIK_ISSUER: "https://auth.dasa122.net/application/o/demo/",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/dasa122_net",
      NODE_ENV: "production",
      PUBLIC_ORIGIN: "https://dasa122.net",
    });
    expect(env.authentik.clientId).toBe("");
    expect(env.authentik.isConfigured).toBe(false);
    expect(env.isProduction).toBe(true);
  });

  test("refuses AUTH_DEV_BYPASS in production", () => {
    const base = {
      AUTHENTIK_ISSUER: "https://auth.dasa122.net/application/o/demo/",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/dasa122_net",
      NODE_ENV: "production",
      PUBLIC_ORIGIN: "https://dasa122.net",
    };
    expect(() => parseEnv({ ...base, AUTH_DEV_BYPASS: "true" })).toThrow();
    expect(
      parseEnv({ ...base, AUTH_DEV_BYPASS: "true", NODE_ENV: "development" })
        .authDevBypass,
    ).toBe(true);
  });

  test("treats an empty AUTH_DEV_BYPASS as false", () => {
    const env = parseEnv({
      AUTH_DEV_BYPASS: "",
      AUTHENTIK_ISSUER: "https://auth.dasa122.net/application/o/demo/",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/dasa122_net",
      PUBLIC_ORIGIN: "https://dasa122.net",
    });
    expect(env.authDevBypass).toBe(false);
  });

  test("normalizes PUBLIC_ORIGIN to its origin", () => {
    const env = parseEnv({
      AUTHENTIK_ISSUER: "https://auth.dasa122.net/application/o/demo/",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/dasa122_net",
      PUBLIC_ORIGIN: "https://dasa122.net/trailing/",
    });
    expect(env.publicOrigin).toBe("https://dasa122.net");
  });
});
