# dasa122.net — Design Spec

**Date:** 2026-11-07
**Status:** Approved for planning
**Owner:** Dasa122

---

## 1. Summary

`dasa122.net` is a personal showcase site with a news feed at its centre. The owner publishes their own writing (devlogs, releases, notes) and the site also surfaces content automatically pulled from GitHub and (tiered) LinkedIn. Every item lives in one `posts` table and renders uniformly in one feed, so the site always reads as *the owner's* site rather than an aggregator.

A separate admin panel — gated behind Authentik OIDC with an OIDC group check — lets the owner write, edit, publish, and configure the site.

## 2. Goals

- A fast, high-end, non-generic personal site with a real news feed.
- The owner can publish and manage posts from a browser admin panel.
- GitHub activity is imported into the feed automatically, with no per-visitor API calls.
- LinkedIn content can be published into the feed today (manual), with automatic sync wired but dormant behind a Partner Program API credential.
- Admin access is protected by Authentik OIDC (authorization code + PKCE) and restricted to a single OIDC group.
- Everything deploys as two containers behind one public hostname.

## 3. Non-goals

- Comments, reactions, or any reader-generated content.
- A CMS for arbitrary page types beyond projects, posts, and settings.
- Multi-admin roles beyond the single `dasa122.net-admin` group.
- Public registration, password accounts, or self-hosted credentials.
- Automated LinkedIn posting (write APIs are Partner Program gated in the same way the read API is).

## 4. Stack

Pinned versions (current on npm as of 2026-11-07):

| Layer | Choice |
|---|---|
| Runtime / PM | Bun 1.4.4 (only package manager) |
| Language | TypeScript (strict) |
| Monorepo | Bun workspaces + Turborepo 2.11.10 |
| Lint / format | Biome 2.6.6 |
| DB | PostgreSQL 18.6 (production: Coolify-managed) + Drizzle ORM 0.45.4 + drizzle-kit 0.31.11 + postgres-js 4.1.0 |
| Validation | Zod 4.6.7 |
| API | oRPC 1.16.2 (`@orpc/contract`, `@orpc/server`, `@orpc/client`, `@orpc/tanstack-query`, `@orpc/openapi`) + Hono 4.13.17 |
| Frontend | React 19.3.1 + TanStack Start 1.169.4 + TanStack Router 1.170.46 + TanStack Query 5.107.1 |
| Build | Vite 8.3.6 (Nitro output, `bun` preset) |
| Styling | Tailwind CSS v4.3.5 |
| Markdown | marked 18.1.3 + shiki 4.6.0 (server-side syntax highlighting) |
| Tests | `bun test` |

## 5. Repository layout

```
dasa122.net/
├── apps/
│   ├── web/            TanStack Start SSR app  (container: web)
│   └── api/            Bun + Hono + oRPC API  (container: api, internal only)
├── packages/
│   ├── contract/       oRPC contract + zod wire schemas
│   └── ui/             shared React components + design tokens
├── drizzle/            Drizzle migrations (committed)
├── docs/
│   └── superpowers/specs/
├── turbo.json
├── biome.json
└── package.json        (workspaces: apps/*, packages/*)
```

`packages/contract` is the single source of truth for every request and response shape. Both apps depend on it; neither depends on the other.

## 6. Domain model

PostgreSQL. All timestamps are `timestamptz`. All ids are `uuid` with `gen_random_uuid()`.

```
posts
  id              uuid  pk
  slug            text  unique          -- only set for status='published'
  title           text  not null
  body            text  null            -- markdown; null for generated posts
  excerpt         text  null            -- generated from body when null
  source          text  not null        -- 'own' | 'github' | 'linkedin'
  status          text  not null        -- 'draft' | 'published'
  external_id     text  null            -- provider-scoped id, enables idempotent sync
  external_url    text  null
  cover_image     text  null
  tags            text[] not null default '{}'
  github_meta     jsonb null            -- { repo, action, commitSha, url, language, stars }
  linkedin_meta   jsonb null            -- { permalink, postedAt }
  read_time_min   int  not null default 1
  published_at    timestamptz null
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  UNIQUE (source, external_id)

projects
  id            uuid pk
  slug          text unique not null
  title         text not null
  summary       text not null
  body          text null
  stack         text[] not null default '{}'
  repo_url      text null
  live_url      text null
  cover_image   text null
  featured      boolean not null default false
  sort_order    int not null default 0
  status        text not null default 'draft'   -- 'draft' | 'published'
  created_at / updated_at

sessions
  id          text pk                  -- opaque 32-byte random, base64url
  subject     text not null            -- Authentik OIDC `sub`
  email       text null
  name        text null
  groups      text[] not null default '{}'
  expires_at  timestamptz not null
  created_at  timestamptz not null default now()

settings
  key         text pk
  value       jsonb not null
  updated_at  timestamptz not null default now()

sync_state
  source       text pk                 -- 'github' | 'linkedin'
  cursor       text null
  last_run_at  timestamptz null
  last_status  text null               -- 'ok' | 'error' | 'not_configured'
  last_error   text null
  updated_at   timestamptz not null default now()

media
  id         uuid pk
  filename   text not null
  mime       text not null
  bytes      int not null
  width      int null
  height     int null
  created_at timestamptz not null default now()
```

There is deliberately **no `users` table**. The only identity concept is "member of the admin group", which rides on the session row.

## 7. API surface

Defined in `packages/contract` with `os.contract` / `os.router`, implemented in `apps/api`.

**Public**

| Procedure | Purpose |
|---|---|
| `posts.list` | Cursor-paginated feed. Filters: `source[]`, `tag`, `year`, `q`, `limit`. |
| `posts.bySlug` | Single published post + prev/next slugs. |
| `posts.related` | Posts sharing at least one tag, excluding the given post. |
| `projects.list` | Published projects, ordered by `sort_order`. |
| `projects.bySlug` | Single published project. |
| `site.get` | Public site settings: name, tagline, description, OG image, accent, social links, github handle, enabled feed sources. |
| `github.overview` | Repos, languages, and activity — **served from the DB cache only**. Never calls GitHub per visitor. |
| `healthz` | Liveness + DB readiness. |

**Admin** (all require a valid session AND the admin group)

| Procedure | Purpose |
|---|---|
| `admin.stats` | Counts for the dashboard: published, drafts, per source, last sync. |
| `admin.posts.list` | All posts including drafts. |
| `admin.posts.create` | Create post (own / linkedin source). |
| `admin.posts.update` | Update post. |
| `admin.posts.delete` | Delete post. |
| `admin.posts.publish` | Publish (sets slug + `published_at`). |
| `admin.posts.unpublish` | Revert to draft. |
| `admin.media.upload` | Multipart image upload → `media` row + file on disk. |
| `admin.github.status` | Token presence, last sync, per-repo inclusion. |
| `admin.github.sync` | Trigger a sync now (returns a summary). |
| `admin.github.featuredRepos` | Choose which repos are featured on `/work` and `/github`. |
| `admin.linkedin.status` | Tier state, and, when Tier 2 is active, the granted scopes. |
| `admin.linkedin.publish` | Publish a pasted LinkedIn post into the feed. |
| `admin.settings.get` / `admin.settings.update` | Read/write the `settings` key-value table. |

**Error map** — defined once with `oc.errors`, consumed by both server and client so failures are discriminated unions rather than strings:

`UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `VALIDATION` · `CONFLICT` · `RATE_LIMITED` · `INTEGRATION_UNAVAILABLE`

**REST surface** — the oRPC OpenAPI handler is mounted at `/api/openapi/*` so the same procedures are reachable over plain HTTP for debugging.

## 8. Authentication and authorization

Authentik OIDC, **authorization code + PKCE**.

- Issuer: `https://auth.dasa122.net/application/o/<slug>/` (slug supplied by the owner when they create the provider).
- Discovery: `<issuer>/.well-known/openid-configuration`, fetched and cached server-side.
- Redirect URI: `https://dasa122.net/api/auth/callback`.
- `state`, `nonce`, and the PKCE verifier are held in a short-lived (10 min) `httpOnly`, `SameSite=Lax`, `Secure` cookie.
- The token exchange happens **server-side only**. The `id_token` is verified for issuer, audience, nonce, and expiry before the `groups` claim is read.
- A successful login creates a `sessions` row and sets an **opaque** session id in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Absolute expiry 30 days; the row is revocable. No JWT is handed to the browser.
- **Admin gate:** every `admin.*` procedure requires the session's `groups` to contain `dasa122.net-admin` (configurable via `AUTHENTIK_ADMIN_GROUP`). A valid session without the group yields `FORBIDDEN`.
- **Unconfigured state:** if `AUTHENTIK_CLIENT_ID` or `AUTHENTIK_CLIENT_SECRET` is empty, the app still boots. `/admin` renders an explicit "Authentik is not configured" panel instead of throwing, and the login route returns a 503 with a clear message.
- `AUTH_DEV_BYPASS=true` grants a local admin session **only** when `NODE_ENV !== 'production'`. It is refused outright in production even if set.
- Logout deletes the session row, clears the cookie, and redirects to the Authentik end-session endpoint.
- CSRF: mutating procedures reject requests whose `Origin` does not match the configured public origin.

### Session and cookie topology

The API container is **internal only** — it has no public FQDN. The web container reverse-proxies `/api/*` to it. Consequences:

- The browser only ever talks to `https://dasa122.net`.
- The session cookie is **host-only for `dasa122.net`** and is never sent to `auth.dasa122.net`, `mail.dasa122.net`, or any other subdomain.
- The API is not reachable from the internet.

## 9. Integrations

Both integrations implement one interface, so a new source is a new file rather than a refactor:

```ts
interface FeedSource {
  readonly source: 'github' | 'linkedin'
  fetchItems(ctx: SyncContext): Promise<PostDraft[]>
}
```

### GitHub — fully automatic, works today

- Credentials: `GITHUB_TOKEN` (fine-grained, read-only). If absent, fall back to the unauthenticated public API (60 req/h) — enough for a single user's public activity.
- Sync worker runs every `GITHUB_SYNC_INTERVAL_MINUTES` (default 15) and can be triggered manually from the admin panel.
- Sources: `GET /users/{username}/events/public` and `GET /users/{username}/repos`.
- Event mapping:

| GitHub event | Feed item |
|---|---|
| `PushEvent` | One item per repository (batched — not one per commit). Title = latest commit subject. |
| `PullRequestEvent` | Item on `opened` and on `merged`. |
| `ReleaseEvent` | Item on `published`. |
| `IssuesEvent`, `IssueCommentEvent` | Item on the relevant activity. |
| `CreateEvent` | **Skipped** — noise. |

- Idempotency: `external_id = "{repo}:{eventId}"` with `UNIQUE (source, external_id)`. A re-sync updates existing rows rather than duplicating.
- The `/github` and `/work` pages read the DB cache. Page views never touch the GitHub API.

### LinkedIn — tiered, because the API is gated

LinkedIn's `r_member_social` scope (required by `GET /rest/posts`) is only available to applications approved into the LinkedIn Partner Program. It cannot simply be enabled for a self-hosted site.

- **Tier 1 (default, no credentials):** the admin panel publishes a LinkedIn item — paste the post body and its permalink. It appears in the feed with a LinkedIn badge. Zero API dependency.
- **Tier 2 (dormant):** with `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_ACCESS_TOKEN` set, a poller calls `/rest/posts`. If the token lacks `r_member_social`, the admin page states precisely that instead of failing silently.

Tier state is surfaced in `admin.linkedin.status` and rendered as an explicit badge in the admin UI — never an ambiguous error.

## 10. Design system

Direction: **"Editorial ink"**, with the terminal/data-panel vocabulary reused only on `/github`.

### Explicitly ruled out (the "looks AI-coded" defaults)

Purple/indigo gradients · Inter as the only typeface · everything in rounded `2xl` cards with soft shadows · centered hero with an eyebrow label and a gradient pill CTA · three equal feature cards with icons · glassmorphism · uniform rounded pills for every action.

### Type

| Role | Face |
|---|---|
| Display / headings | **Instrument Serif** (high-contrast, slightly literary) |
| UI / body | **Instrument Sans** |
| Metadata, timestamps, tags, slugs, code | **JetBrains Mono** |

Self-hosted (no runtime CDN dependency). Three faces only. `text-wrap: balance` on headings; `font-variant-numeric: tabular-nums` on all numeric metadata; prose measure capped at `68ch`.

### Color

Light is the default. Dark is a genuinely separate palette, not an inversion.

- Light: warm paper `oklch(0.97 0.005 85)`, ink `oklch(0.18 0.01 60)`, hairline rules `oklch(0.88 0.006 85)`.
- Dark: `oklch(0.16 0.008 60)` canvas, `oklch(0.93 0.006 85)` text.
- One **ember** accent (`oklch(0.58 0.17 45)`) used **only** for interactive affordances and source badges — never for decoration.

### Layout

- 12-column grid with deliberately empty cells. Asymmetry is a feature, not a bug.
- Hairline `1px` dividers instead of card borders.
- Section rhythm: large vertical gaps (`clamp(4rem, 10vw, 9rem)`) between major sections.
- No nested cards. No card-inside-card-inside-card.

### Motion

- 400ms `cubic-bezier(0.2, 0, 0, 1)` fade + 8px rise on section entry, via `IntersectionObserver`.
- Underline-draw on link hover.
- No springs, no parallax, no floating elements.
- `prefers-reduced-motion` disables all of it.

### Typography detail

Headings use `text-wrap: balance`; body copy uses `text-wrap: pretty`; numeric metadata uses `tabular-nums`; inline code and tags use the mono face at a slightly reduced size with a hairline background, never a rounded pill.

## 11. Pages

| Route | Purpose |
|---|---|
| `/` | Hero (name + one-line positioning), featured work strip, **news feed** as the centrepiece. |
| `/news` | Full feed — filter by source (all / mine / GitHub / LinkedIn), tag, year. Cursor pagination. |
| `/news/$slug` | Post detail — rendered markdown with shiki highlighting, reading time, source badge, share row, prev/next. |
| `/work` | Selected projects as an editorial index (not a three-card grid). |
| `/work/$slug` | Project detail — problem / approach / outcome, stack list, links. |
| `/github` | Live GitHub: repos, languages, contribution rhythm, activity graph. Terminal/data-panel vocabulary. |
| `/about` | Bio, current focus, elsewheres, contact. |
| `/admin/*` | Admin panel — see §13. |

Every page ships a correct `<title>`, `<meta name="description">`, canonical URL, and Open Graph + Twitter card tags. `/news/$slug` and `/work/$slug` render server-side for full social previews.

## 12. News post model

One `posts` table serves all three sources.

- **own** — full markdown body, author-written. The canonical case.
- **github** — generated. Title = commit subject or PR/release title. `body` is null; the card renders from `github_meta`. Read-only in the admin UI (cannot be edited, only hidden).
- **linkedin** — pasted body plus permalink. Editable.

The feed renders all three uniformly with a source badge, so the homepage always looks like a personal site. Source-specific chrome (a repo chip, a LinkedIn mark) is the only visible difference.

## 13. Admin panel

All routes require a valid Authentik session in the `dasa122.net-admin` group.

| Route | Contents |
|---|---|
| `/admin` | Dashboard — counts, recent activity, last sync status per source. |
| `/admin/news` | Post list with filters and a create button. |
| `/admin/news/new`, `/admin/news/$id` | Editor — title, slug, body (markdown), excerpt override, tags, cover image, source selector, draft/publish. |
| `/admin/github` | Token health, last sync, sync-now button, per-repo inclusion, featured-repo selection. |
| `/admin/linkedin` | Tier badge, scope status, paste-to-publish form. |
| `/admin/settings` | Site name, tagline, description, OG image, accent, social links, GitHub handle, enabled feed sources. |

Editing is client-side state with a **server-validated** save. Drafts are autosaved server-side on an explicit "Save draft" action — there is no silent background autosave.

## 14. Errors and logging

- Structured JSON logging with a redacting serializer. API keys, client secrets, access tokens, and PKCE verifiers never appear in a log line. Error bodies from providers are read to at most 4 KB and reduced to a truncated `error` / `error_description` pair.
- Every provider failure degrades to a visible, specific state in the admin UI (for example, "LinkedIn token lacks `r_member_social`") rather than a generic 500.
- Public feed failures render a distinct error state, never an empty feed that reads as "no posts yet".
- Markdown from posts is sanitized server-side before rendering (raw HTML escaped; no script/style/iframe passthrough).

## 15. Testing

`bun test` at the workspace root.

**Unit** — slug generation and collision handling · excerpt + reading-time derivation · markdown sanitisation · PKCE/state/nonce generation and verification · Authentik `id_token` claim validation · the admin group gate · GitHub event → post mapping · sync idempotency via `external_id` · LinkedIn tier state machine · excerpt/excerpt-from-github-meta fallbacks.

**Integration** (against a dedicated local Postgres test database, migrations applied) — posts repository CRUD and pagination · the unique `(source, external_id)` constraint behaviour · settings key-value access · session create/expire/revoke · admin procedure guard behaviour for anonymous, wrong-group, and valid-admin sessions.

**Smoke** — boot the API and curl the public and admin endpoints, asserting status codes and shapes.

## 16. Development and deployment

### Local development

- Postgres: the native PostgreSQL 18.6 server on `localhost:5432`. Create a dedicated database `dasa122_net` (and `dasa122_net_test`); **never** touch `filc_359_filcdev_hu`.
- `apps/api` runs on `:3001`; `apps/web` runs on `:3000` with a Vite dev proxy for `/api` → `http://localhost:3001`.
- Both connect to the same local database.

### Containers

| App | Build | Runtime | Port |
|---|---|---|---|
| `web` | `vite build` with `NITRO_PRESET=bun` → `.output/server/index.mjs` | `oven/bun:1-alpine`, `bun run .output/server/index.mjs` | 3000 |
| `api` | `bun build` → `dist/index.js` | `oven/bun:1-alpine`, `bun run dist/index.js` | 3001 |

Both run as a non-root user. The `web` container proxies `/api/*` to `http://api:3001`.

Healthchecks use `wget -q -O-` (busybox) with a `curl` fallback — the Alpine base image has no `curl` by default.

### Coolify

- Project: `dasa122.net`.
- App `web`: FQDN `https://dasa122.net`, port 3000, env `API_INTERNAL_URL=http://api:3001`, `PUBLIC_ORIGIN=https://dasa122.net`.
- App `api`: **no FQDN** (internal only), port 3001, env `DATABASE_URL`, `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_ADMIN_GROUP=dasa122.net-admin`, `GITHUB_TOKEN`, `GITHUB_USERNAME`, `GITHUB_SYNC_INTERVAL_MINUTES`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `SESSION_SECRET`, `NODE_ENV=production`.
- Database: Coolify-managed PostgreSQL, `is_public: false`.

### DNS and reverse proxy (already done by the owner)

- `dasa122.net` → `84.2.16.116`, DNS-only (not proxied). Already in place.
- The apex is **not** covered by the existing `*.dasa122.net` wildcard certificate, so Caddy must obtain a separate certificate for `dasa122.net`. HTTP-01 works because Caddy owns port 80 on that IP.
- The Caddy block forwards to Coolify Traefik at `10.0.1.80:443` with `header_up Host {host}` and `tls_insecure_skip_verify` — matching the existing pattern for the other hostnames.
- `auth.dasa122.net` → `84.2.16.116`, already in place; Authentik provider created by the owner with redirect URI `https://dasa122.net/api/auth/callback`.

### Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PUBLIC_ORIGIN` | yes | — | e.g. `https://dasa122.net`; used for CSRF origin checks and cookie scope |
| `API_INTERNAL_URL` | web only | `http://api:3001` | Internal API base for the web proxy |
| `AUTHENTIK_ISSUER` | yes | — | e.g. `https://auth.dasa122.net/application/o/dasa122-net/` |
| `AUTHENTIK_CLIENT_ID` | yes | — | Empty ⇒ admin shows "not configured" |
| `AUTHENTIK_CLIENT_SECRET` | yes | — | Empty ⇒ admin shows "not configured" |
| `AUTHENTIK_ADMIN_GROUP` | no | `dasa122.net-admin` | The OIDC group that grants admin |
| `SESSION_SECRET` | yes | — | Signing/derivation secret for session cookies |
| `SESSION_TTL_DAYS` | no | `30` | Absolute session lifetime |
| `AUTH_DEV_BYPASS` | no | `false` | Local-only; refused when `NODE_ENV=production` |
| `GITHUB_TOKEN` | no | — | Fine-grained read-only PAT; absent ⇒ unauthenticated public API |
| `GITHUB_USERNAME` | no | `Dasa122` | Account whose activity is imported |
| `GITHUB_SYNC_INTERVAL_MINUTES` | no | `15` | Sync cadence |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_ACCESS_TOKEN` | no | — | Tier 2 only |
| `MEDIA_DIR` | no | `./media` | Where uploaded images are written |
| `NODE_ENV` | yes | — | `production` in the deployed environment |

## 17. Commit plan

Each commit is independently meaningful and leaves the tree green.

```
1  chore: scaffold bun monorepo (workspaces, biome, turbo)
2  feat(contract): oRPC contract + zod wire schemas
3  feat(db): drizzle schema + initial migration
4  feat(api): oRPC server, procedure base, error map, logger
5  feat(auth): authentik OIDC PKCE + sessions + admin group gate
6  feat(api): post CRUD + feed queries
7  feat(api): media upload
8  feat(api): github sync worker
9  feat(api): linkedin provider (tiered)
10 feat(web): design system, tokens, layout shell
11 feat(web): home + news feed + post detail
12 feat(web): work + github + about pages
13 feat(admin): dashboard, post editor, settings
14 test: unit + integration suites
15 ci/docs: github actions + readme + deploy runbook
```

Implementation happens on a branch off `main` (never directly on `main`), per the project's standard run protocol.

## 18. Open items for the owner

1. **Authentik provider** — create an OIDC provider under `https://auth.dasa122.net/application/o/<slug>/` with redirect URI `https://dasa122.net/api/auth/callback`, and place `Dasa122` in the `dasa122.net-admin` group. Supply the slug, client id, and client secret.
2. **GitHub token** — a fine-grained PAT with read-only public-repository scope, if the unauthenticated rate limit is too low.
3. **LinkedIn** — Tier 1 works immediately; Tier 2 needs Partner Program approval and a token carrying `r_member_social`.
4. **GitHub remote** — create the repository (owner action) and push.
