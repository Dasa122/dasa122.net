# dasa122.net

A personal site for Dasa122: a project showcase and a news feed that combines
the owner's own posts with activity imported from GitHub and LinkedIn.

## Stack

Bun 1.4.4 · TypeScript (strict) · Turborepo · React 19 + TanStack Start ·
oRPC · PostgreSQL 18 + Drizzle ORM · Tailwind CSS v4 · Biome · `bun:test`

## Layout

```
apps/api             Bun API: oRPC/REST, auth, integrations, media, migrations
apps/web             TanStack Start SSR site and admin panel
packages/contract    shared oRPC contract and zod schemas
packages/ui          shared React components
```

## Local development

Requires Bun 1.4.4 and PostgreSQL 18 on `localhost:5432`.

```bash
PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE DATABASE dasa122_net;"
PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE DATABASE dasa122_net_test;"
cp .env.example .env
set -a; . ./.env; set +a
bun install
bun run dev -- --env-mode=loose
```

Turborepo's default strict environment mode would drop the variables, so they
are sourced into the shell and `--env-mode=loose` passes them to both apps. The
web app listens on <http://localhost:3000> and proxies `/api` to the API on
<http://localhost:3001>; the API applies migrations at boot.

`/admin` is the admin panel. With `AUTHENTIK_CLIENT_ID` and
`AUTHENTIK_CLIENT_SECRET` empty it reports the login route as not configured;
`AUTH_DEV_BYPASS=true` grants a local admin session outside production.

## Behaviour notes

- Projects are published on creation; the create input has no `status` field.
- A project's `body` is stored but not shown publicly yet: the API returns no
  rendered HTML for projects.
- LinkedIn's tier is probed against `/rest/posts`: `200` is `active`, `403` is
  `insufficient_scope`, anything else is `manual`. The result is cached in the
  `settings` table under `linkedin:tier`.
- `LINKEDIN_SYNC_INTERVAL_MINUTES` sets the LinkedIn probe and sync cadence
  (default `60`).
- `MEDIA_DIR` defaults to `./media` locally and `/app/media` in the image;
  uploads are served from `/api/media/<filename>`.
- Both schedulers only sync at boot when `sync_state.lastRunAt` is older than
  the interval, so restart storms cannot exhaust a rate limit.

## REST

REST is served under `/api`: OpenAPI at `/api/doc/openapi.json`, Swagger UI at `/api/doc/swagger`.

Array query parameters use bracket notation: `?sources[0]=own` for one value and
`?sources[0]=own&sources[1]=github` for several. A bare `?sources=own` returns
`400` because a single key decodes to a scalar rather than an array.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev -- --env-mode=loose` | run both apps in watch mode (see Local development) |
| `bun run lint` | Biome check and write fixes |
| `bun run typecheck` | TypeScript across every workspace |
| `bun run build` | production build of every workspace |
| `bun run test` | `bun:test` suites |

## Documents

- [Design spec](docs/superpowers/specs/2026-11-07-dasa122-net-design.md)
- [Implementation plan](docs/superpowers/plans/2026-11-07-dasa122-net.md)
- [Deployment runbook](docs/deployment.md)
