import z from "zod";

/** The configuration the server needs, after validation. */
export type McpConfig = {
  apiUrl: string;
  token: string;
};

const schema = z.object({
  DASA_API_URL: z.url().default("http://localhost:3001"),
  DASA_MCP_TOKEN: z.string().trim().min(8),
});

/**
 * Parses the MCP server's environment. The token is required, so a missing one
 * fails here with a message that names the variable instead of surfacing as a
 * 401 on the first tool call.
 */
export function parseConfig(
  raw: Record<string, string | undefined>,
): McpConfig {
  if ((raw.DASA_MCP_TOKEN ?? "").trim() === "") {
    throw new Error(
      "DASA_MCP_TOKEN is required: use the same value as the api's MCP_TOKEN",
    );
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid MCP configuration: ${z.prettifyError(parsed.error)}`,
    );
  }

  return {
    apiUrl: parsed.data.DASA_API_URL.replace(/\/+$/, ""),
    token: parsed.data.DASA_MCP_TOKEN,
  };
}

/** Reads the configuration from the process environment. */
export function loadConfig(): McpConfig {
  return parseConfig(process.env);
}
