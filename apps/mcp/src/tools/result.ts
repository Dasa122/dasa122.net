import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpError } from "../client";

/** A successful tool call: a short human summary plus the raw API payload. */
export function textResult(
  text: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ text, type: "text" }],
    structuredContent,
  };
}

/**
 * A failed tool call. `isError` is set so the model retries or reports instead
 * of treating the message as data; the token is never part of the message.
 */
export function errorResult(error: unknown): CallToolResult {
  const message =
    error instanceof McpError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unknown error";
  return {
    content: [{ text: `Request failed: ${message}`, type: "text" }],
    isError: true,
  };
}
