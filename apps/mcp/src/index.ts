#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type ApiClient, createClient } from "./client";
import { loadConfig } from "./config";
import { registerTools } from "./tools/index";

const SERVER_NAME = "dasa-mcp";
const SERVER_VERSION = "0.1.0";

/** Builds the server with every tool registered against `client`. */
export function buildServer(client: ApiClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerTools(server, client);
  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const server = buildServer(createClient(config));
  await server.connect(new StdioServerTransport());
  // stdout is reserved for protocol frames; every log line goes to stderr.
  console.error(`${SERVER_NAME}: connected to ${config.apiUrl}/api`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${SERVER_NAME}: ${message}`);
    process.exit(1);
  });
}
