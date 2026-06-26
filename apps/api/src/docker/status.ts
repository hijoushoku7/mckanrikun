/**
 * Docker のコンテナ状態を、アプリ内の統一ステータスへ正規化する。
 * UI 表示(起動中 / 停止 / 起動処理中 / 異常 / 不明)に対応(要件 FR-1)。
 */
export type ServerStatus =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "error"
  | "unknown";

/**
 * 正常停止とみなす終了コード。
 * MC(itzg)サーバーは停止時 SIGTERM(143=128+15)で終了し、
 * タイムアウト後 SIGKILL なら 137(128+9)になる。手動 SIGINT は 130。
 * これらは正常停止であり、error ではなく stopped として扱う。
 */
const GRACEFUL_EXIT_CODES = new Set([0, 130, 137, 143]);

/**
 * docker inspect の State.Status / Health を正規化。
 * @param state 例: "running" | "exited" | "created" | "restarting" | "paused" | "dead"
 * @param health 例: "starting" | "healthy" | "unhealthy"(HEALTHCHECK 設定時のみ)
 * @param exitCode 終了コード(exited 時)。正常停止コード以外は異常とみなす。
 */
export const normalizeStatus = (
  state: string | undefined,
  health?: string | undefined,
  exitCode?: number | undefined,
): ServerStatus => {
  switch (state) {
    case "running":
      // HEALTHCHECK が starting/unhealthy のうちは起動処理中/異常として扱う。
      if (health === "starting") return "starting";
      if (health === "unhealthy") return "error";
      return "running";
    case "restarting":
    case "created":
      return "starting";
    case "paused":
      return "stopped";
    case "exited":
      // exitCode 不明(undefined)や正常停止コードは stopped、それ以外のみ error。
      return exitCode === undefined || GRACEFUL_EXIT_CODES.has(exitCode)
        ? "stopped"
        : "error";
    case "dead":
      return "error";
    default:
      return "unknown";
  }
};
