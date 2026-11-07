FROM oven/bun:1.4.4-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

FROM base AS prepare
RUN bun install -g turbo
COPY . .
RUN turbo prune @dasa122/web --docker

FROM base AS builder
COPY --from=prepare /app ./
RUN bun install --frozen-lockfile
RUN bun run build --filter=@dasa122/web

FROM base AS release
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/dist ./apps/web/dist
USER bun
EXPOSE 3000/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:3000/healthz" || exit 1
ENTRYPOINT ["bun", "/app/apps/web/node_modules/srvx/bin/srvx.mjs", "serve", "--prod", "--port", "3000", "-s", "/app/apps/web/dist/client", "/app/apps/web/dist/server/server.js"]
