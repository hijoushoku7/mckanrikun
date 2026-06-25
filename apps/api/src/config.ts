/**
 * アプリ全体の設定。環境変数から読み込み、未設定時は LAN 内開発向けの既定値を使う。
 */
const num = (v: string | undefined, fallback: number): number => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  /** API サーバーの待ち受けポート */
  port: num(process.env.PORT, 8080),
  /** SQLite ファイルの保存先 */
  dbPath: process.env.DB_PATH ?? "./data/app.db",
  /** セッション Cookie 名 */
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "mck_session",
  /** セッション有効期間(秒)。既定 7 日。 */
  sessionTtlSec: num(process.env.SESSION_TTL_SEC, 60 * 60 * 24 * 7),
  /** Cookie に Secure 属性を付けるか(TLS 配下なら true)。 */
  cookieSecure: process.env.COOKIE_SECURE === "true",
  /** CORS で許可するフロントエンドのオリジン。 */
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  /** 初期 admin 作成用(db:seed で利用)。 */
  initialAdminUser: process.env.INITIAL_ADMIN_USER ?? "admin",
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD ?? "",
  /** Docker Engine API の Unix ソケットパス。 */
  dockerSocket: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
  /** コンテナ状態ポーリング間隔(ミリ秒)。 */
  statusPollMs: num(process.env.STATUS_POLL_MS, 5000),
} as const;
