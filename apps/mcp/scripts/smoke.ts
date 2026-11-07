#!/usr/bin/env bun
/**
 * Drives the stdio server the way a real MCP client does: spawn it, send
 * `initialize`, `tools/list`, then `tools/call` frames and print the answers.
 *
 *   DASA_MCP_TOKEN=... bun run --cwd apps/mcp scripts/smoke.ts
 *   DASA_MCP_TOKEN=... bun run --cwd apps/mcp scripts/smoke.ts --full
 *
 * `--full` also proves the write path against a real API: a draft post is
 * created, listed, patched and deleted, and a one-field settings patch is
 * checked to leave every other field untouched (then restored).
 */

type JsonRpcResponse = {
  error?: unknown;
  id?: number;
  result?: unknown;
};

type ToolCallResult = {
  content: { text?: string; type: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

const serverEntry = `${import.meta.dir}/../src/index.ts`;
const full = process.argv.includes("--full");

const proc = Bun.spawn([process.execPath, "run", serverEntry], {
  cwd: `${import.meta.dir}/..`,
  env: process.env,
  stderr: "pipe",
  stdin: "pipe",
  stdout: "pipe",
});

const decoder = new TextDecoder();
const reader = proc.stdout.getReader();
const pending = new Map<number, (message: JsonRpcResponse) => void>();
let buffer = "";
let nextId = 1;

async function readLoop(): Promise<void> {
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (line === "") {
        continue;
      }
      const message = JSON.parse(line) as JsonRpcResponse;
      if (typeof message.id === "number") {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      }
    }
  }
}

const reading = readLoop();

function send(payload: Record<string, unknown>): Promise<void> {
  proc.stdin.write(`${JSON.stringify(payload)}\n`);
  return Promise.resolve(proc.stdin.flush()).then(() => undefined);
}

function request(method: string, params?: unknown): Promise<JsonRpcResponse> {
  const id = nextId++;
  const answer = new Promise<JsonRpcResponse>((resolve) =>
    pending.set(id, resolve),
  );
  void send({ id, jsonrpc: "2.0", method, params });
  return answer;
}

function notify(method: string, params?: unknown): Promise<void> {
  return send({ jsonrpc: "2.0", method, params });
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: ToolCallResult; text: string }> {
  const response = await request("tools/call", { arguments: args, name });
  if (response.error !== undefined) {
    throw new Error(`${name} failed: ${JSON.stringify(response.error)}`);
  }
  const result = response.result as ToolCallResult;
  const text =
    result.content.find((block) => block.type === "text")?.text ?? "";
  if (result.isError === true) {
    throw new Error(`${name} returned an error: ${text}`);
  }
  return { result, text };
}

function structured(result: ToolCallResult): Record<string, unknown> {
  return result.structuredContent ?? {};
}

async function main(): Promise<void> {
  const initialized = await request("initialize", {
    capabilities: {},
    clientInfo: { name: "dasa-smoke", version: "1.0.0" },
    protocolVersion: "2025-06-18",
  });
  if (initialized.error !== undefined) {
    throw new Error(`initialize failed: ${JSON.stringify(initialized.error)}`);
  }
  await notify("notifications/initialized");

  const list = await request("tools/list", {});
  if (list.error !== undefined) {
    throw new Error(`tools/list failed: ${JSON.stringify(list.error)}`);
  }
  const tools = (list.result as { tools: { name: string }[] }).tools;
  console.log(`tools/list: ${tools.map((tool) => tool.name).join(", ")}`);

  const settings = await callTool("dasa_settings_get", {});
  console.log(`dasa_settings_get: ${settings.text}`);

  const news = await callTool("dasa_news_list", { limit: 3 });
  console.log(`dasa_news_list: ${news.text.split("\n")[0]}`);

  if (!full) {
    return;
  }

  await proveSettingsPatch(settings.result);
  await proveNewsLoop();
}

async function proveSettingsPatch(before: ToolCallResult): Promise<void> {
  const original = structured(before);
  const tagline = `mcp smoke ${Date.now()}`;

  const patched = await callTool("dasa_settings_update", { tagline });
  console.log(`dasa_settings_update: ${patched.text}`);

  const reread = await callTool("dasa_settings_get", {});
  const after = structured(reread.result);
  const changed = Object.keys(after).filter(
    (key) => JSON.stringify(after[key]) !== JSON.stringify(original[key]),
  );
  console.log(`settings changed keys: ${changed.join(", ") || "(none)"}`);
  if (changed.length !== 1 || changed[0] !== "tagline") {
    throw new Error(
      `expected only tagline to change, got ${JSON.stringify(changed)}`,
    );
  }

  await callTool("dasa_settings_update", { tagline: original.tagline });
  const restored = structured((await callTool("dasa_settings_get", {})).result);
  const drifted = Object.keys(original).filter(
    (key) => JSON.stringify(restored[key]) !== JSON.stringify(original[key]),
  );
  if (drifted.length > 0) {
    throw new Error(`settings drifted after restore: ${drifted.join(", ")}`);
  }
  console.log("settings restored: every field matches the original");
}

async function proveNewsLoop(): Promise<void> {
  const title = `MCP smoke ${Date.now()}`;

  const created = await callTool("dasa_news_create", {
    body: "Created by the MCP smoke test.",
    source: "own",
    title,
  });
  const id = structured(created.result).id as string;
  console.log(`dasa_news_create: ${created.text}`);

  const listed = await callTool("dasa_news_list", { limit: 50 });
  const items = (structured(listed.result).items ?? []) as { id: string }[];
  if (!items.some((item) => item.id === id)) {
    throw new Error(`created post ${id} is missing from dasa_news_list`);
  }
  console.log(`dasa_news_list: found ${id}`);

  const updated = await callTool("dasa_news_update", {
    id,
    title: `${title} (patched)`,
  });
  console.log(`dasa_news_update: ${updated.text}`);

  const deleted = await callTool("dasa_news_delete", { id });
  console.log(`dasa_news_delete: ${deleted.text}`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`smoke failed: ${message}`);
  console.error(`server stderr:\n${await new Response(proc.stderr).text()}`);
  proc.kill();
  process.exit(1);
}

proc.kill();
await proc.exited;
await reading;
