import z from "zod";

const booleanFlag = z
  .preprocess(
    (value) => (value === "" ? "false" : value),
    z.enum(["true", "false", "1", "0"]).default("false"),
  )
  .transform((value) => value === "true" || value === "1");

const schema = z
  .object({
    API_ORIGIN: z.string().trim().min(1).default("https://dasa122.net"),
    AUTH_DEV_BYPASS: booleanFlag,
    AUTHENTIK_ADMIN_GROUP: z
      .string()
      .trim()
      .min(1)
      .default("dasa122.net-admin"),
    AUTHENTIK_CLIENT_ID: z.string().trim().default(""),
    AUTHENTIK_CLIENT_SECRET: z.string().trim().default(""),
    AUTHENTIK_ISSUER: z.url(),
    DATABASE_URL: z.string().trim().min(1),
    GITHUB_SYNC_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(15),
    GITHUB_TOKEN: z.string().trim().default(""),
    GITHUB_USERNAME: z.string().trim().min(1).default("Dasa122"),
    LINKEDIN_ACCESS_TOKEN: z.string().trim().default(""),
    LINKEDIN_CLIENT_ID: z.string().trim().default(""),
    LINKEDIN_CLIENT_SECRET: z.string().trim().default(""),
    LINKEDIN_SYNC_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    MEDIA_DIR: z.string().trim().min(1).default("./media"),
    NODE_ENV: z.string().trim().min(1).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    PUBLIC_ORIGIN: z.url(),
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  })
  .transform((raw) => {
    const isProduction = raw.NODE_ENV === "production";
    if (isProduction && raw.AUTH_DEV_BYPASS) {
      throw new Error("AUTH_DEV_BYPASS must not be enabled in production");
    }
    return {
      apiOrigin: raw.API_ORIGIN,
      authDevBypass: raw.AUTH_DEV_BYPASS,
      authentik: {
        adminGroup: raw.AUTHENTIK_ADMIN_GROUP,
        clientId: raw.AUTHENTIK_CLIENT_ID,
        clientSecret: raw.AUTHENTIK_CLIENT_SECRET,
        isConfigured:
          raw.AUTHENTIK_CLIENT_ID !== "" && raw.AUTHENTIK_CLIENT_SECRET !== "",
        issuer: raw.AUTHENTIK_ISSUER,
      },
      databaseUrl: raw.DATABASE_URL,
      github: {
        syncIntervalMinutes: raw.GITHUB_SYNC_INTERVAL_MINUTES,
        token: raw.GITHUB_TOKEN,
        username: raw.GITHUB_USERNAME,
      },
      isProduction,
      linkedin: {
        accessToken: raw.LINKEDIN_ACCESS_TOKEN,
        clientId: raw.LINKEDIN_CLIENT_ID,
        clientSecret: raw.LINKEDIN_CLIENT_SECRET,
        syncIntervalMinutes: raw.LINKEDIN_SYNC_INTERVAL_MINUTES,
      },
      mediaDir: raw.MEDIA_DIR,
      nodeEnv: raw.NODE_ENV,
      port: raw.PORT,
      publicOrigin: new URL(raw.PUBLIC_ORIGIN).origin,
      sessionTtlDays: raw.SESSION_TTL_DAYS,
    };
  });

export type Env = z.output<typeof schema>;

/**
 * Validates a raw environment bag. Throws when a required value is missing or
 * malformed, and refuses the auth dev bypass outright in production. Empty
 * Authentik credentials are valid: they just mean the login route is not
 * configured yet.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  return schema.parse(raw);
}

export const env: Env = parseEnv(process.env);
