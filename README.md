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
(既定 `http://localhost:8080`)。Docker デーモンへアクセスできるユーザーで API を起動すること
(`/var/run/docker.sock`)。

## 本番デプロイ(docker compose 一式)

Ubuntu Server 単一ホストでの本番運用は同梱の `docker-compose.yml`(api / web / ftp)を使う。

```bash
cp .env.example .env      # 各値を環境に合わせて編集(下表)
docker compose up -d --build
# 初期 admin を作成(初回のみ)
docker compose run --rm api npm run db:seed
```

| 変数 | 説明 |
|---|---|
| `SERVER_DATA_ROOT` | 各 MC サーバーの `/data` を置く**ホストの絶対パス**(必須)。api/ftp に同一パスでマウントされる。 |
| `NEXT_PUBLIC_API_BASE` | ブラウザから到達する API URL(web のビルド時に埋め込み)。 |
| `WEB_ORIGIN` | api の CORS 許可オリジン(= web の公開 URL)。 |
| `COOKIE_SECURE` | TLS リバースプロキシ配下なら `true`。 |
| `FTP_PASSWORD` / `FTP_PUBLISH_HOST` | FTP のパスワードと LAN クライアントから到達可能なホスト IP。 |
| `INITIAL_ADMIN_PASSWORD` | 初期 admin パスワード(`db:seed` 用)。 |

> **重要(バインド整合)**: api はコンテナ内で動くが、生成する MC コンテナのバインドマウントは
> *ホストの* Docker デーモンが解釈する。そのため `SERVER_DATA_ROOT` は絶対パスとし、
> api コンテナにも同一パスでマウントする(compose に設定済み)。

> api コンテナは `/var/run/docker.sock` をマウントしてホスト上に MC コンテナを生成する。
> ソケットへのアクセス権限に注意。

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
- **Phase 7(仕上げ)**: ダッシュボードの状態表示・エラーハンドリング/トースト/ローディングの最終化、
  本番 docker compose 一式(api/web/ftp)+ Dockerfile、セットアップ手順整備。

## 通し動作確認シナリオ(本番ホスト)

Docker が利用可能な本番ホストで、4 ローダーそれぞれについて以下を確認する(要件 7-4):

1. admin でログイン →「新規サーバー作成」。
2. ローダー(Vanilla / Forge / NeoForge / Fabric)・MC バージョン・(必要なら)ローダーバージョンを選択。
   Java タグが自動表示されることを確認。メモリ・ポートを指定、EULA に同意して作成。
3. ダッシュボードでステータスが `starting`→`running` に遷移することを確認。
4. サーバー名(コンソール)を開き、ログがリアルタイム表示され、`list` 等のコマンドが
   RCON で実行できることを確認。
5. 設定画面で `server.properties`(例: `motd`)を編集・保存(要再起動の明示を確認)。
   メモリ割当を変更(コンテナ再作成)。
6. FTP で `/<server-id>/mods` に jar を配置できることを確認(接続情報は `/ftp` 画面)。
7. サーバーを停止 → 削除。`/ports` でポート使用状況が更新されることを確認。

## FTP(MOD 配置)

`docker compose up -d ftp` で FTP サーバーを起動(要 `FTP_PASSWORD` 等の環境変数。
`SERVER_DATA_ROOT` を管理アプリと一致させる)。各サーバーの mods は FTP で
`/<server-id>/mods` へ配置する。Web からのアップロードは行わない(スコープ外)。

## パッケージ方針

`docs/requirements.md` §10 の承認リストに従う。`npm audit` はクリーン(0 件)を維持する。
