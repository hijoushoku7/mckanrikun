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
- **Phase 3(サーバー作成ウィザード)**: バージョンメタ取得(Vanilla/Fabric/NeoForge/Forge、
  1時間キャッシュ)、MC バージョン → Java タグ 自動決定(§6, 外部設定)、EULA 同意、メモリ上限、
  ポート手動指定 + 重複バリデーション、itzg 環境変数へのマッピングでコンテナ生成。
  作成ウィザード UI + サーバー一覧ダッシュボード。
- **Phase 4(コンソール)**: コンテナログのリアルタイム配信(WebSocket, 直近バッファ + ライブ)、
  RCON 経由のコマンド送信(`POST /api/servers/:id/console`)、ターミナル風コンソール UI。
- **Phase 5(設定編集)**: `server.properties` を GUI フォームで編集(主要項目、型・範囲バリデーション、
  要再起動項目の明示)。`GET/PUT /api/servers/:id/properties`。
- **Phase 6(FTP 連携 & リソース表示)**: FTP サーバー(pure-ftpd)を docker compose で定義、
  接続情報の表示(`/ftp`)、ポート使用状況一覧(`/ports`、FTP ポートも登録)、メモリ割当の編集反映
  (`PATCH /api/servers/:id`、コンテナ再作成)。
- **Phase 7(仕上げ)**: ダッシュボード/エラーハンドリング/セットアップ手順の最終化。

## FTP(MOD 配置)

`docker compose up -d ftp` で FTP サーバーを起動(要 `FTP_PASSWORD` 等の環境変数。
`SERVER_DATA_ROOT` を管理アプリと一致させる)。各サーバーの mods は FTP で
`/<server-id>/mods` へ配置する。Web からのアップロードは行わない(スコープ外)。

## パッケージ方針

`docs/requirements.md` §10 の承認リストに従う。`npm audit` はクリーン(0 件)を維持する。
