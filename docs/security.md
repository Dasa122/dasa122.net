# Security in CI

Three workflows run in `.github/workflows`:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | push to `main`, every PR | `biome check`, typecheck, build, and the test suite against a real Postgres |
| `security.yml` | push to `main`, every PR, weekly, manual | actionlint, hadolint, Trivy on the dependency tree and secret scanning; Trivy on both built images off pull requests |
| `codeql.yml` | push to `main`, every PR, weekly, manual | CodeQL for `javascript-typescript` and for the workflows themselves |

`dependabot.yml` opens weekly pull requests for GitHub Actions and for the
Bun dependency graph (`bun.lock`, through the `npm` ecosystem).

## What fails a pull request

- `actionlint` — any workflow syntax or expression error.
- `hadolint` — Dockerfile findings at **error** level. Style advice is allowed
  by `.hadolint.yaml`, which also ignores `DL3059` (the deliberate consecutive
  `RUN` layers in both Dockerfiles).
- `trivy fs --scanners vuln,secret --severity CRITICAL,HIGH --ignore-unfixed` —
  a fixable critical or high CVE, or any detected secret.
- `ci.yml` as before.

Misconfiguration findings and the SARIF upload do **not** fail the build: the
former is report-only, and the latter is refused while code scanning is
switched off.

## CodeQL is gated on purpose

Code scanning on a **private** repository requires GitHub Advanced Security.
Without it the upload fails with `403 Code scanning is not enabled` and the
CodeQL job cannot start. So `codeql.yml` runs only when either:

- the repository is public, or
- the repository variable `ENABLE_CODEQL` is `true`.

To turn it on: **Settings → Code security** (enable code scanning), then
**Settings → Secrets and variables → Actions → Variables → New repository
variable**, name `ENABLE_CODEQL`, value `true`. The same switch also makes the
Trivy SARIF upload start populating the Security tab.

## Running the same checks locally

```bash
# workflows
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color

# Dockerfiles
for f in apps/api/Dockerfile apps/web/Dockerfile; do
  docker run --rm -v "$PWD:/repo" -w /repo hadolint/hadolint:2.12.0 \
    hadolint --config /repo/.hadolint.yaml "$f"
done

# dependencies and secrets, the way CI gates them
docker run --rm -v "$PWD:/repo" -w /repo aquasec/trivy:latest fs \
  --no-progress --scanners vuln,secret --severity CRITICAL,HIGH \
  --ignore-unfixed --skip-dirs node_modules .
```

## Suppressing a finding

Add it to `.trivyignore.yaml` with a reason and an expiry, rather than lowering
the severity threshold:

```yaml
vulnerabilities:
  - id: CVE-0000-00000
    statement: "No patched release yet; the route is not reachable."
    expired_at: 2026-12-31
```

`--ignore-unfixed` is already set, so a finding only appears once a fixed
version exists — that is precisely the kind of finding worth acting on.
