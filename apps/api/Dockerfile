# ───────── builder: 依存インストール(native ビルド)+ TS コンパイル ─────────
FROM node:22-bookworm AS builder
WORKDIR /app

# native モジュール(argon2 / better-sqlite3)のビルドツールは bookworm に同梱。
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# workspaces 解決のためルートで install。素の npm は install スクリプトを実行し
# native モジュール(argon2 / better-sqlite3)を自動ビルドする。
RUN npm ci

COPY apps/api/ apps/api/
RUN npm run build --workspace apps/api \
  # 本番依存のみへ刈り込み(devDependencies を除去)。
  && npm prune --omit=dev

# ───────── runner: 本番ランタイム(リポジトリ構成をミラー)─────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# ルート node_modules を /app/node_modules に。Node の上方探索で apps/api から解決される。
COPY --from=builder /app/node_modules /app/node_modules
# ビルド成果物 + ランタイム参照(drizzle/config)+ package.json。
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/drizzle /app/apps/api/drizzle
COPY --from=builder /app/apps/api/config /app/apps/api/config
COPY --from=builder /app/apps/api/package.json /app/apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 8080
# 起動時にマイグレーション適用(冪等)→ API 起動。初期 admin は `npm run db:seed`。
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
