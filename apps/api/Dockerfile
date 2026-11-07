FROM oven/bun:1.4.4-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS prepare
RUN bun install -g turbo
COPY . .
RUN turbo prune @dasa122/api --docker

FROM base AS builder
COPY --from=prepare /app ./
RUN bun install --frozen-lockfile
RUN bun run build --filter=@dasa122/api

FROM base AS release
ENV PORT=3001
ENV MEDIA_DIR=/app/media
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/src/database/migrations ./src/database/migrations
RUN mkdir -p /app/media && chown bun:bun /app/media
USER bun
EXPOSE 3001/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:3001/api/health" || exit 1
ENTRYPOINT ["bun", "--bun", "run", "dist/index.js"]
