FROM oven/bun:1.4.4-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

FROM base AS builder
ARG VITE_API_ORIGIN=https://dasa122.net
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build --filter=@dasa122/web
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
    && bun install --production --frozen-lockfile

FROM base AS release
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/dist ./apps/web/dist
# esbuild is a Go build-time bundler; nothing loads it at runtime, and shipping
# it drags 26 Go stdlib CVEs into the image scan. Drop it and its platform
# package (the real files live under node_modules/.bun, the top-level entry is a
# symlink), covering both the hoisted and the per-package install trees.
RUN rm -rf \
      node_modules/.bun/@esbuild+* \
      node_modules/@esbuild \
      apps/*/node_modules/.bun/@esbuild+* \
      apps/*/node_modules/@esbuild \
      packages/*/node_modules/.bun/@esbuild+* \
      packages/*/node_modules/@esbuild
USER bun
EXPOSE 3000/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:3000/healthz" || exit 1
ENTRYPOINT ["bun", "/app/apps/web/node_modules/srvx/bin/srvx.mjs", "serve", "--prod", "--port", "3000", "-s", "/app/apps/web/dist/client", "/app/apps/web/dist/server/server.js"]
