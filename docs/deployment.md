# 本番デプロイ手順

Minecraft サーバー管理 Web アプリを **Ubuntu Server 単一ホスト**へ本番デプロイする手順。
同梱の `docker-compose.yml`(api / web / ftp)を用いる。

> 構成・要件の全体像は [`requirements.md`](requirements.md)、開発時の起動は
> [`../README.md`](../README.md) を参照。

---

## 1. 前提

| 項目 | 要件 |
|---|---|
| OS | Ubuntu Server(LAN 内、管理画面と MC サーバーは同一ホスト) |
| Docker | Docker Engine + Docker Compose v2(`docker compose` サブコマンド) |
| 権限 | デプロイ実行ユーザーが Docker を操作できること(`docker` グループ所属、または root) |
| ネットワーク | LAN 内からアクセス。MC / RCON / FTP の各ポートが到達可能であること |

```bash
docker --version          # Docker Engine
docker compose version    # Compose v2
```

`itzg/minecraft-server` などのイメージ取得のため、ホストから外部ネットワークへ出られること
(バージョンメタ取得 API へのアクセスも必要)。

---

## 2. 取得と配置

```bash
git clone <このリポジトリ> mckanrikun
cd mckanrikun
```

各 MC サーバーのワールドデータを置く**ホストの絶対パス**を用意する(例)。

```bash
sudo mkdir -p /opt/mc/servers
# デプロイ実行ユーザーが読み書きできるよう所有者を調整
sudo chown "$USER":"$USER" /opt/mc/servers
```

---

## 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、環境に合わせて編集する。

```bash
cp .env.example .env
```

| 変数 | 必須 | 説明 | 例 |
|---|---|---|---|
| `SERVER_DATA_ROOT` | ✅ | 各 MC サーバーの `/data` を置く**ホスト絶対パス**。api/ftp に同一パスでマウントされる(後述「バインド整合」)。 | `/opt/mc/servers` |
| `NEXT_PUBLIC_API_BASE` | ✅ | ブラウザから到達する API の URL。web の**ビルド時**に埋め込まれる。 | `http://192.168.1.10:8080` |
| `WEB_ORIGIN` | ✅ | api の CORS 許可オリジン(= web の公開 URL)。 | `http://192.168.1.10:3000` |
| `FTP_PASSWORD` | ✅ | FTP ログインパスワード。 | (任意の強い値) |
| `FTP_PUBLISH_HOST` | ✅ | LAN クライアントから到達可能なホスト IP(パッシブ FTP に必要)。 | `192.168.1.10` |
| `INITIAL_ADMIN_USER` | | 初期 admin のユーザー名。 | `admin` |
| `INITIAL_ADMIN_PASSWORD` | | 初期 admin パスワード(初回起動時に作成)。未設定ならランダム生成しログ出力。 | (任意の強い値) |
| `API_PORT` / `WEB_PORT` | | 公開ポート(ホスト側)。既定 8080 / 3000。 | |
| `FTP_PORT` | | FTP 制御ポート。既定 21。 | |
| `FTP_USER` | | FTP ユーザー名。既定 `mcadmin`。 | |
| `FTP_PASSIVE_PORT_START` / `_END` | | FTP パッシブポート範囲。既定 30000–30009。 | |
| `COOKIE_SECURE` | | TLS リバースプロキシ配下なら `true`。 | `false` |

> `.env` は秘密情報を含むため**コミットしない**(`.gitignore` 済み)。リポジトリの
> `.env.example` の IP はあくまで例なので、実環境の `.env` では実 IP に置き換える。

### ホスト IP の指定について(重要)

`NEXT_PUBLIC_API_BASE` / `WEB_ORIGIN` / `FTP_PUBLISH_HOST` には、**クライアント端末の
ブラウザ・FTP クライアントから到達できる「サーバーの LAN プライベート IP」**(例
`192.168.1.10`)または LAN 内で解決できるホスト名を指定する。

- `NEXT_PUBLIC_API_BASE` は **web のビルド時にブラウザ JS へ焼き込まれる**。実際に API を
  叩くのはクライアント端末のブラウザなので、`localhost` / `127.0.0.1` を指定すると
  「閲覧している端末自身」を指してしまい、サーバー本機以外からは接続できない。
- そのため LAN 内の他 PC からも使うなら、これらは**必ずサーバーの実 IP / ホスト名**にする。
  `localhost` で良いのは「サーバー本機のブラウザからのみ利用する」場合だけ。
- ビルド時固定のため、**IP を変えたら `docker compose up -d --build` で web を再ビルド**する。
  DHCP で IP が変動すると接続できなくなるので、**固定 IP / DHCP 予約**、または安定した
  **LAN ホスト名**の利用を推奨する。

### バインド整合(重要)

api はコンテナ内で動作するが、api が生成する **MC コンテナのバインドマウントは
*ホストの* Docker デーモンが解釈する**。そのため `SERVER_DATA_ROOT` は絶対パスとし、
api コンテナにも**同一の絶対パス**でマウントする(compose に設定済み:
`${SERVER_DATA_ROOT}:${SERVER_DATA_ROOT}`)。これにより、

- api コンテナ内のファイル書き込み(`server.properties` 等)
- ホスト上に生成される MC コンテナのバインド(`/data`)
- FTP コンテナのマウント

がすべて同じ実体のディレクトリを指す。`SERVER_DATA_ROOT` に相対パスを指定しないこと。

---

## 4. 起動

```bash
docker compose up -d --build
```

- 3 サービス(api / web / ftp)がビルド・起動する。
- **api は起動時に自動で**「DB マイグレーション → 初期 admin の作成(冪等)」を行う。
  - admin は `INITIAL_ADMIN_USER` / `INITIAL_ADMIN_PASSWORD` から作成。既に存在すればスキップ。
  - `INITIAL_ADMIN_PASSWORD` 未設定時はランダム生成され、ログに出力される:

    ```bash
    docker compose logs api | grep -A1 'generated password'
    ```

起動確認:

```bash
docker compose ps
curl -s http://localhost:${API_PORT:-8080}/health      # {"ok":true}
```

ブラウザで `http://<ホスト IP>:3000`(= `NEXT_PUBLIC_API_BASE` に対応する web)へアクセスし、
admin でログインする。

---

## 5. 初期セットアップ(画面操作)

1. **ログイン**: admin アカウントでログイン。
2. **ユーザー追加(任意)**: ユーザー管理画面で `operator` / `viewer` を必要に応じ作成(RBAC)。
3. **サーバー作成**: 「新規サーバー作成」からローダー・MC バージョン・メモリ・ポート・EULA 同意を指定して作成。
   - Java タグは MC バージョンから自動決定される。
   - 初回起動時に itzg がローダーを自動ダウンロードするため、`starting` → `running` まで時間がかかる。

---

## 6. MOD の配置(FTP)

- 接続情報は管理画面の **「FTP」ページ**に表示される(ホスト/ポート/ユーザー)。
- 各サーバーの mods 配置先は **`/<server-id>/mods`**(server-id は作成済みサーバーの ID)。
- FTP クライアント(FileZilla 等)で `FTP_PUBLISH_HOST:FTP_PORT` に `FTP_USER` で接続し、
  `/<server-id>/mods` に jar をアップロードする。
- 反映にはサーバーの再起動が必要。
- **Web 画面からの MOD アップロードは行わない**(スコープ外)。

---

## 7. 運用

### ログ確認
```bash
docker compose logs -f api      # 管理 API
docker compose logs -f web      # UI
docker compose logs -f ftp      # FTP
```
個々の MC サーバーのログは管理画面のコンソール、または `docker logs mc-<server-id>`。

### 更新(再デプロイ)
```bash
git pull
docker compose up -d --build
```
DB マイグレーションは api 起動時に冪等適用される。

### admin の再作成 / パスワード初期化
```bash
docker compose run --rm api node dist/db/seed.js
```
(既存 admin がある場合はスキップ。完全な作り直しは DB ボリュームの扱いに注意)

### バックアップ
- **管理 DB(SQLite)**: 名前付きボリューム `mc-manager-db`。
  ```bash
  docker run --rm -v mckanrikun_mc-manager-db:/data -v "$PWD":/backup alpine \
    tar czf /backup/db-backup.tar.gz -C /data .
  ```
- **ワールドデータ**: `SERVER_DATA_ROOT`(例 `/opt/mc/servers`)をそのままバックアップ。

### 停止 / 撤去
```bash
docker compose stop            # 停止
docker compose down            # コンテナ削除(DB ボリューム・ワールドは保持)
docker compose down -v         # ボリュームも削除(管理 DB が消える。要注意)
```
> 注意: MC サーバーコンテナは管理アプリが動的生成するため compose の管理外。
> `docker compose down` では削除されない。撤去時は管理画面から各サーバーを削除するか、
> `docker rm -f $(docker ps -aq --filter label=mc-manager.managed=true)` で一括削除する。

---

## 8. TLS / リバースプロキシ(任意)

LAN 内利用のため必須ではないが、TLS を併用する場合は web/api の前段にリバースプロキシ
(Nginx / Caddy / Traefik 等)を置き、

- `COOKIE_SECURE=true` を設定、
- `NEXT_PUBLIC_API_BASE` / `WEB_ORIGIN` を https の公開 URL に合わせて再ビルド

する。

---

## 9. 通し動作確認(リリース判定)

実 Docker ホストで、4 ローダー(Vanilla / Forge / NeoForge / Fabric)それぞれについて確認する
(要件 §9 Phase 7-4)。

1. admin でログイン →「新規サーバー作成」。
2. ローダー・MC バージョン・(必要なら)ローダーバージョンを選択。Java タグ自動表示を確認。
   メモリ・ポートを指定、EULA 同意で作成。
3. ダッシュボードで `starting` → `running` を確認。
4. コンソールでログのリアルタイム表示と、`list` 等の RCON コマンド実行を確認。
5. 設定画面で `server.properties`(例 `motd`)を編集・保存(要再起動の明示)。メモリ変更(再作成)。
6. FTP で `/<server-id>/mods` に jar を配置できることを確認。
7. サーバーを停止 → 削除し、`/ports` の使用状況が更新されることを確認。

---

## 10. トラブルシューティング

| 症状 | 確認 / 対処 |
|---|---|
| ログインできない / admin が無い | `docker compose logs api` で seed の出力を確認。`INITIAL_ADMIN_PASSWORD` 未設定ならログにランダムパスワードが出る。`docker compose run --rm api node dist/db/seed.js` で再作成。 |
| サーバーが `starting` のまま | 初回はローダー DL 中。`docker logs mc-<server-id>` を確認。メモリ不足やバージョン不整合の可能性。 |
| サーバーが `error` | コンテナ起動失敗。MC ログを確認。メモリ上限・EULA・ポート競合を見直す。 |
| 作成が 409(ポート競合) | `/ports` 画面で使用状況を確認し、空きポートを指定。 |
| ブラウザから API に繋がらない / CORS エラー | `NEXT_PUBLIC_API_BASE`(ビルド時)と `WEB_ORIGIN` がホストの実 URL と一致しているか。変更時は `--build` で web を再ビルド。 |
| FTP に接続できない / 転送が止まる | `FTP_PUBLISH_HOST` が LAN から到達可能な IP か、パッシブポート範囲(30000–30009)が開いているか。 |
| api が MC コンテナを作れない | `/var/run/docker.sock` のマウントと権限を確認。`SERVER_DATA_ROOT` が絶対パスで identity マウントされているか(「バインド整合」)。 |
