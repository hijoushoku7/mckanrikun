# mckanrikun — Minecraft サーバー管理 Web アプリ

ローカルネットワーク向けに、複数の Minecraft サーバー(Docker コンテナ)をブラウザから
起動・停止・コンソール操作・設定編集・新規作成できる管理コンソール。

要件は [`docs/requirements.md`](docs/requirements.md) を参照。

## 構成(npm workspaces モノレポ)

| パス | 役割 | 技術 |
|---|---|---|
| `apps/api` | API / BFF | Hono + better-sqlite3 + drizzle + argon2 |
| `apps/web` | 管理 UI | Next.js 16 + React 19 + Tailwind v4 |

## 開発セットアップ

前提: Node.js 22 以上。

```bash
# 依存インストール(ネイティブモジュールのビルド承認が必要)
npm install
npm approve-scripts argon2 better-sqlite3   # 初回のみ

# API: DB マイグレーション → 初期 admin 作成
cp apps/api/.env.example apps/api/.env       # 必要なら編集
npm run db:migrate
INITIAL_ADMIN_PASSWORD=変更してください npm run db:seed

# 起動(別ターミナルで)
npm run dev:api    # http://localhost:8080
npm run dev:web    # http://localhost:3000
```

`apps/web/.env.example` を `apps/web/.env.local` にコピーし、API のオリジンを設定する
(既定 `http://localhost:8080`)。

## 現在の実装状況

- **Phase 1(認証基盤)**: ログイン(セッション Cookie)、RBAC(admin/operator/viewer)、
  ユーザー管理画面(admin 限定)。
- **Phase 2(Docker オーケストレーション層)**: Docker Engine API(Unix ソケット)接続、
  コンテナの生成/起動/停止/再起動/削除ラッパー、管理ラベルによる識別・再認識(再起動耐性)、
  状態のポーリング + イベント購読。サーバー操作 API(`/api/servers`)。
- Phase 3 以降(作成ウィザード / コンソール / 設定編集 / FTP)は順次実装予定。

## パッケージ方針

`docs/requirements.md` §10 の承認リストに従う。`npm audit` はクリーン(0 件)を維持する。
