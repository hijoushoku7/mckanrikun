# ───────── builder: 依存インストール + Next ビルド(standalone)─────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
# web はビルドに native モジュール不要。api の install スクリプトは無視。
RUN npm ci --ignore-scripts

COPY apps/web/ apps/web/
# API のベース URL はビルド時に埋め込まれる(NEXT_PUBLIC_*)。
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
RUN npm run build --workspace apps/web

# ───────── runner: standalone ランタイム ─────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# standalone 出力(server.js + 同梱 node_modules)+ 静的アセット。
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
