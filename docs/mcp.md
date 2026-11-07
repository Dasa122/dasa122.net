# MCP server

`apps/mcp` is a stdio [Model Context Protocol](https://modelcontextprotocol.io)
server that lets an agent manage news posts and site settings on dasa122.net.
It talks to the existing API over HTTP; it does not touch the database.

The API accepts its callers through a service token: a request with
`Authorization: Bearer <MCP_TOKEN>` is treated as an admin session. Cookie
sessions and the CSRF origin check are unchanged — a bearer client sends no
`Origin`, which the existing check already allows.

Sending an `Authorization` header disables the cookie path for that request, so
a malformed bearer is never silently treated as a cookie session. There is no
revocation list: expiring the token currently means rotating `MCP_TOKEN` and
restarting the API.

## Tools

| Tool | What it does |
| --- | --- |
| `dasa_news_list` | List posts, drafts included (`cursor`, `limit`, `source`, `status`) |
| `dasa_news_create` | Create a draft post |
| `dasa_news_update` | Patch a post; omitted fields keep their values |
| `dasa_news_publish` | Publish a draft |
| `dasa_news_unpublish` | Turn a published post back into a draft |
| `dasa_news_delete` | Delete a post |
| `dasa_settings_get` | Read the site settings |
| `dasa_settings_update` | Patch the settings; only the supplied keys change |

Every tool returns a short text summary plus the raw API payload as
`structuredContent`.

## Environment

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DASA_API_URL` | no | `http://localhost:3001` | Base URL of the API (the client appends `/api`) |
| `DASA_MCP_TOKEN` | **yes** | — | Must equal the API's `MCP_TOKEN`; at least 8 characters |

The API side reads `MCP_TOKEN`. Empty means bearer auth is disabled.

## Run locally

Start the API with a token (and the usual local env), then run the server:

```bash
# terminal 1 — apps/api
MCP_TOKEN=test-token-123 AUTH_DEV_BYPASS=true bun run dev

# terminal 2 — stdio server
DASA_API_URL=http://localhost:3001 DASA_MCP_TOKEN=test-token-123 \
  bun run --cwd apps/mcp start
```

A scripted end-to-end smoke test is committed as
`apps/mcp/scripts/smoke.ts`. It spawns the server, performs `initialize`,
`tools/list` and read calls, and with `--full` proves the create → list → patch
→ delete loop plus the one-field settings patch:

```bash
DASA_API_URL=http://localhost:3001 DASA_MCP_TOKEN=test-token-123 \
  bun run --cwd apps/mcp scripts/smoke.ts --full
```

## Client configuration

opencode (`~/.config/opencode/opencode.jsonc` — shown for reference only; this
repository does not edit it):

```jsonc
{
  "mcp": {
    "dasa": {
      "type": "local",
      "command": ["bun", "run", "--cwd", "/home/dasa122/Projects/dasa122.net/apps/mcp", "start"],
      "environment": {
        "DASA_API_URL": "https://dasa122.net",
        "DASA_MCP_TOKEN": "<token>"
      },
      "enabled": true
    }
  }
}
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dasa": {
      "command": "bun",
      "args": ["run", "--cwd", "/home/dasa122/Projects/dasa122.net/apps/mcp", "start"],
      "env": {
        "DASA_API_URL": "https://dasa122.net",
        "DASA_MCP_TOKEN": "<token>"
      }
    }
  }
}
```

## Production

Set `MCP_TOKEN` on the **api** app in Coolify (runtime environment, not a build
arg) to the same value used by `DASA_MCP_TOKEN`, then restart the app. Leaving
it empty disables bearer auth entirely.
