/**
 * Test preload. `env.ts` parses `process.env` at module load and throws when a
 * required variable is absent, so every suite that transitively imports the
 * database must run with a valid bag. `??=` keeps any value the caller already
 * supplied (CI, a shell export) and only fills the gaps.
 */
process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/dasa122_net_test";
process.env.PUBLIC_ORIGIN ??= "http://localhost:3001";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef";
process.env.AUTHENTIK_ISSUER ??= "https://auth.dasa122.net/application/o/test/";
