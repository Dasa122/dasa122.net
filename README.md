# dasa122.net

A personal showcase site with a news feed at its centre — the owner's own writing plus automatically surfaced GitHub and (tiered) LinkedIn activity.

Status: design spec in progress — no code yet.

The full design spec lives in [`docs/superpowers/specs/2026-11-07-dasa122-net-design.md`](docs/superpowers/specs/2026-11-07-dasa122-net-design.md).

## Stack at a glance

Bun · TypeScript (strict) · Turborepo workspaces · React 19 + TanStack Start · oRPC + Hono · PostgreSQL 18 + Drizzle ORM · Tailwind CSS v4

## Layout

`apps/web` (SSR app) · `apps/api` (internal API) · `packages/contract` · `packages/ui` · `drizzle/` (migrations committed)
