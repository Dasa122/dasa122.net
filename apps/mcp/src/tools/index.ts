import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../client";
import { registerNewsTools } from "./news";
import { registerSettingsTools } from "./settings";

/** Registers every dasa122.net tool on the given server. */
export function registerTools(server: McpServer, client: ApiClient): void {
  registerNewsTools(server, client);
  registerSettingsTools(server, client);
}
