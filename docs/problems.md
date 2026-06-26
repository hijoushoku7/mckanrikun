## 修正してほしい問題点
* コンソールが増えるたびに無限にページスクロールが発生する。→ 一画面に固定してスクロールで読み込めるようにしてほしい。
* デザインがダサい。 アニメーションを追加したい
* 左側の欄に最後に起動したサーバーを表示してすぐ行けるようにしてほしい
* 起動ボタンや停止ボタンを押した際に更新がされない。
* サーバーのコンソール画面への導線がサーバー一覧、サーバー設定、コンソールとなっているため難しい。コンソールも設定と同じとこでいけるようにして。
* 設定画面でサーバーのRUNNING/ERRORって出るところで、コンテナが起動していない場合にERRORが出るようになっている。STOPPINGって出るようにして。

---

## 原因分析と解決策

各問題について、コードを調査した上での原因と解決策をまとめる。
(調査時点のコード基準。ファイルパスは `apps/` 以下。)

### 1. コンソールが増えるたびに無限にページスクロールが発生する

**原因**
`web/app/servers/[id]/console/page.tsx` のレイアウト高さが「ビューポート固定」になっていない。

- 一番外側のラッパが `minHeight: "100dvh"`（`ConsolePage` の `<div>`）。`minHeight` は「最低でも画面高さ、コンテンツが増えれば無限に伸びる」指定。
- `main` も高さ上限を持たず（flex 子要素だが `min-height: 0` 指定がない）、内部のログ枠 `flex:1; minHeight:420px` とログ本文 `flex:1; overflowY:auto` を持つ。
- flexbox では子要素はデフォルトで `min-height: auto`（=コンテンツ分は縮まない）。そのため最大2000行(`MAX_LOG_LINES`)のログが溜まると、ログ本文の `overflowY:auto` が効かず、本文がそのまま縦に伸び → `main` → 外側ラッパが画面より高くなり、**ページ全体がスクロール**する。

**解決策**
高さをビューポートに固定し、内側のログ本文だけがスクロールするようにする。

- 外側ラッパ: `minHeight: "100dvh"` → `height: "100dvh"` + `overflow: "hidden"`。
- `main` と中間の縦フレックス（`ConsoleContent` 直下の `<div>`）に `minHeight: 0` を追加（flex 子が内容より縮めるようにする。これが無いと内側の `overflow:auto` が効かない）。
- ログ枠の `minHeight: "420px"` は `minHeight: 0` に変更（固定高ではなく残り領域いっぱいに）。
- これで `logViewRef` の本文だけが内部スクロールし、ヘッダ／コマンド入力は固定される。「一画面固定＋ログ内スクロール」になる。

### 2. デザインがダサい / アニメーションを追加したい

**現状**
全てインライン `style` のベタ書きで、トランジションは一部のボタンの `border-color`/`opacity` のみ。`globals.css` には `.pixel-border` と focus ring 程度しかアニメーションが無い。

**解決策（提案）**
`globals.css` に共通アニメーションを追加し、各コンポーネントから利用する。

- キーフレーム: `fadeIn`（カード/行の出現）、`slideInUp`（トースト）、`pulse`（`starting` ステータスバッジを点滅させ「処理中」を視覚化）、`spin`（既存 Spinner を CSS 化）。
- 一覧テーブル行・カードに `animation: fadeIn .2s ease`、ホバーで `transform: translateY(-1px)` + `box-shadow` の微妙な浮き。
- ボタンに `transition: all .15s ease` と `:active { transform: scale(.97) }`。
- `StatusBadge` の `running` に淡いグロー、`starting` に `pulse`。
- アクセシビリティのため `@media (prefers-reduced-motion: reduce)` でアニメーションを無効化する分岐も入れる。
- 中長期的にはインライン style を CSS クラス（または CSS Modules / Tailwind ユーティリティ）へ寄せると保守性・統一感が上がる。

### 3. 左側の欄に「最後に起動したサーバー」を表示

**原因（現状不足している点）**
`db/schema.ts` の `servers` テーブルに「最後に起動した時刻」を保持するカラムが無い。`Sidebar.tsx` も静的な `NAV_ITEMS` のみ。

**解決策**
1. スキーマに `lastStartedAt`（`integer timestamp_ms`、nullable）を追加（drizzle マイグレーション）。
2. `services/servers.ts` の `controlServer` で `action === "start" | "restart"` 時に `lastStartedAt = new Date()` を更新。`createServer` の初回起動時も同様。
3. API（`GET /servers` または専用 `GET /servers/recent`）で `lastStartedAt` を返す。
4. `Sidebar.tsx` で一覧を取得し、`lastStartedAt` が最大のサーバーを「最近起動」セクションとして表示、`/servers/{id}/console` へのリンクを置く。
   - 軽量に済ませるなら、ダッシュボードの起動操作時にクライアント側で `localStorage` に `lastStartedServerId` を保存し Sidebar で読む方法もあるが、サーバー間・ブラウザ間で共有されないため **DB カラム方式を推奨**。


### 5. 起動/停止ボタンを押した際に更新がされない

**原因**
`services/servers.ts` の `controlServer` は `docker start/stop/restart` を投げた**直後**に `getStatus` を読む。コンテナの状態遷移(starting→running、stopping→stopped)は時間がかかるため、返るのは過渡的/直前の状態になりがち。

- 一覧画面(`(dashboard)/page.tsx`)は操作後に一度 `fetchServers()` するが、これも遷移途中を拾う。次の自動ポーリングは **10秒後** なので、その間バッジが変わらず「更新されない」ように見える。
- `stop` は `dockerService.stop({ t: 30 })`(graceful 最大30秒待ち)のため、HTTP リクエスト自体が最長30秒ブロックし、行が `busy`(opacity 0.7)のまま固まって見える。
- さらに、設定/コンソール画面は `getServer` を**マウント時に1回**取得するだけで再ポーリングしないため、状態変化が反映されない。

**解決策**
1. 操作直後に楽観的更新: `start/restart` → 即 `starting`、`stop` → 即 `stopping`(下記7の新ステータス)を表示。
2. 操作後の数秒間だけポーリング間隔を詰める(例: 操作後 ~30秒は2秒間隔、その後10秒へ戻す)か、状態が確定するまで短間隔で再フェッチ。
3. `stop` の長時間ブロックを避けるため、API はコマンド送出後すぐ `202`/現ステータスを返し、確定はポーリングに委ねる(または `stop` 呼び出しを await しないで投げる)。
4. 設定/コンソール画面にも軽量ポーリング(または操作後の再取得)を入れる。

### 6. コンソールへの導線が分かりにくい（設定と同じ場所から行けるように）

**原因**
一覧画面の操作列には「設定/削除/起動/停止/再起動」はあるが**「コンソール」ボタンが無い**。コンソールへはサーバー名リンク(`servers/{id}/console`)からしか行けず気づきにくい。

**解決策**
- `(dashboard)/page.tsx` の操作列、「設定」リンクの隣に「コンソール」リンク(`/servers/{id}/console`)を追加し、設定と並列の導線にする。
- 設定画面側には既にヘッダに「コンソール →」リンクがあるので、相互に行き来できる。逆方向にコンソール画面のヘッダにも「設定」リンクを追加するとさらに分かりやすい。

### 7. 設定画面で停止中コンテナが ERROR と表示される（STOPPING にしたい）

**原因**
`docker/status.ts` の `normalizeStatus` が「`exited` かつ exitCode が 0 以外」を一律 `error` にしている。
Minecraft(itzg)サーバーは停止時に SIGTERM で終了するため終了コードが **143**(=128+15)、タイムアウト後 SIGKILL なら **137** になることが多く、**正常停止でも非0終了コード → `error` 表示**になってしまう。

- なお一覧画面(`docker/service.ts` の `listManaged`)は `normalizeStatus(c.State, undefined, undefined)` と **exitCode を渡していない**ため `stopped` 判定になる。一方、設定/コンソール画面の単体取得(`refreshServerStatus` → `getStatus` → `inspect`)は exitCode を渡すので `error` になる。**画面間で表示が食い違う**のが根本。

**解決策**
1. `normalizeStatus` で、正常停止に相当する終了コード(`0`, `130`(SIGINT), `137`(SIGKILL), `143`(SIGTERM))を `stopped` 扱いにする。本当に異常終了したケース(例: クラッシュの 1 など)だけ `error` に残す。
2. ユーザー要望の「STOPPING」を出すなら、停止処理中を表す過渡ステータス `stopping` を `ServerStatus` に追加し、`controlServer` の `stop` 実行中に楽観的に `stopping` を返す（上記5と連動）。停止完了後は `stopped`。`StatusBadge` / `web/lib/types.ts` の `ServerStatus` にも `stopping` を追加して配色を定義。
3. 単体取得と一覧で同じ正規化ロジック(exitCode 込み)を使うよう統一し、画面間の食い違いを解消する。