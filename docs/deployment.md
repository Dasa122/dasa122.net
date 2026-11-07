# Deployment

Runbook for `https://dasa122.net`: a web application and an API, both built from
this repository and served behind one hostname. Commands are meant to be pasted
from the repository root unless a step says otherwise.

## 1. Prerequisites

- **Authentik provider.** An OIDC client/application for this site whose redirect
  URI is exactly `https://dasa122.net/api/auth/callback` — same scheme, host,
  path and no trailing slash. Note its issuer (`AUTHENTIK_ISSUER`), client ID and
  client secret.
- **Admin group.** The Authentik group `dasa122.net-admin` exists and contains the
  owner's account. Group membership comes from the `groups` claim.
- **GitHub PAT.** A fine-grained, read-only token with access to public
  repositories. Without it the GitHub sync uses the unauthenticated API and a
  much lower rate limit.
- **DNS and proxy host.** `dasa122.net` points at the proxy host (`A` record,
  DNS-only) and Caddy on that host owns ports 80 and 443.

## 2. The repository

```bash
gh repo create Dasa122/dasa122.net --private --source=. --remote=origin
git push -u origin feat/build-dasa122-net
```

If the `origin` remote already exists, add it instead of creating it:

```bash
git remote add origin git@github.com:Dasa122/dasa122.net.git
git push -u origin feat/build-dasa122-net
```

## 3. The Coolify project

1. Create the project `dasa122.net`.
2. Create a **PostgreSQL 18** database named `dasa122.net-db`. Leave
   **Make it publicly available** off (`is_public: false`). Copy its internal
   connection URL — that is the API's `DATABASE_URL`.
3. Create the **api** application from `Dasa122/dasa122.net`.
   - Branch: `feat/build-dasa122-net` for the first deploy; switch to `main`
     after merging.
   - Build pack: `Dockerfile`, base directory `/`, Dockerfile path
     `apps/api/Dockerfile`.
   - Port: `3001`. FQDN: `https://dasa122.net/api`.
   - Persistent storage: volume mounted at `/app/media`, or uploaded images are
     lost on every redeploy.

   The API serves every route under `/api`, so it must receive the request path
   unchanged. In the application's **Advanced → Proxy** settings confirm **Path
   prefixes** is set to **Keep paths as-is** (strip prefix off). The instance
   this runbook was written against does not strip by default, but the setting
   is worth confirming explicitly: if it were on, Traefik would forward
   `/health` instead of `/api/health`, and every API route would 404 while the
   container's own healthcheck — which calls `/api/health` from inside the
   container — stayed green.
4. Create the **web** application from the same repository.
   - Branch and base directory as above.
   - Build pack: `Dockerfile`, Dockerfile path `apps/web/Dockerfile`.
   - Port: `3000`. FQDN: `https://dasa122.net`.

Both applications share the hostname: Coolify's Traefik routes `/api` to the
API and everything else to the web app.

## 4. Environment variables

**api**

```
DATABASE_URL=postgres://postgres:<password>@<database-service>:5432/postgres
PUBLIC_ORIGIN=https://dasa122.net
AUTHENTIK_ISSUER=https://auth.dasa122.net/application/o/dasa122-net/
AUTHENTIK_CLIENT_ID=<client-id>
AUTHENTIK_CLIENT_SECRET=<client-secret>
AUTHENTIK_ADMIN_GROUP=dasa122.net-admin
GITHUB_TOKEN=<fine-grained-pat>
GITHUB_USERNAME=Dasa122
GITHUB_SYNC_INTERVAL_MINUTES=15
LINKEDIN_CLIENT_ID=<linkedin-client-id>
LINKEDIN_CLIENT_SECRET=<linkedin-client-secret>
LINKEDIN_ACCESS_TOKEN=<linkedin-access-token>
LINKEDIN_SYNC_INTERVAL_MINUTES=60
MEDIA_DIR=/app/media
NODE_ENV=production
```

`PUBLIC_ORIGIN` is required: it drives CSRF origin checks and the OAuth
callback. Do not set `AUTH_DEV_BYPASS` in production — the API refuses to boot
with it. `API_ORIGIN`, `PORT`, `SESSION_TTL_DAYS` and `AUTHENTIK_ADMIN_GROUP`
have working defaults and can be omitted.

**web** needs **no runtime environment variables**. Its API origin is fixed at
build time — `VITE_API_ORIGIN` is inlined by `vite build` and falls back to
`https://dasa122.net` — and `NODE_ENV=production` is already set in the image.
To point a build at a different origin, pass `VITE_API_ORIGIN` as a **build
argument**; setting it at runtime has no effect.

## 5. The reverse proxy

The apex `dasa122.net` is **not** covered by the `*.dasa122.net` wildcard
certificate, so Caddy obtains a separate certificate for the apex. HTTP-01 works
because Caddy owns port 80 on that address.

```caddyfile
dasa122.net {
	encode zstd gzip
	reverse_proxy 10.0.1.80:443 {
		header_up Host {host}
		transport http {
			tls_insecure_skip_verify
		}
	}
}
```

Reload after saving the block:

```bash
sudo systemctl reload caddy
```

**The API needs no extra DNS record and no extra certificate.** It shares the
apex under the `/api` path prefix; the single `dasa122.net` hostname above covers
both applications.

## 6. Verification

Run these from the LAN after the first deploy:

```bash
curl -sI https://dasa122.net/
# expect: HTTP/2 200

curl -s https://dasa122.net/api/health
# expect: {"database":"up","status":"ok","version":"..."}

curl -s -o /dev/null -w '%{http_code}\n' https://dasa122.net/healthz
# expect: 200

curl -s https://dasa122.net/api/doc/openapi.json
# expect: the OpenAPI document (JSON)
```

Finally, open `https://dasa122.net/admin` and sign in. The Authentik round trip
must land back on `/admin` with an admin session.

## 7. Troubleshooting

- **`503` from the apex.** The upstream application is not running. Check the
  Coolify deployment log for the `web` application and that its healthcheck
  passes.
- **Authentik callback mismatch.** The provider's redirect URI does not exactly
  match `https://dasa122.net/api/auth/callback`. Compare scheme, host, path and
  trailing slash character by character.
- **Session cookie is not sent.** The app is being served over plain HTTP in
  development while the cookie is `Secure`, because `PUBLIC_ORIGIN` still uses
  `https`. Check the scheme in `PUBLIC_ORIGIN`.
- **Web healthcheck fails.** The `/healthz` route is missing from the running web
  build. Rebuild the `web` application and confirm the route answers on port
  3000.
- **`/api/*` returns 404 while Coolify reports the application healthy.** The
  container healthcheck calls `/api/health` from inside the container, so a
  path-prefix mismatch is invisible to it. Check the **Path prefixes** setting
  in step 3.
