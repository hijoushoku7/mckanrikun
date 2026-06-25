/**
 * Docker のコンテナ状態を、アプリ内の統一ステータスへ正規化する。
 * UI 表示(起動中 / 停止 / 起動処理中 / 異常 / 不明)に対応(要件 FR-1)。
 */
export type ServerStatus =
  | "running"
  | "stopped"
  | "starting"
  | "error"
  | "unknown";

/**
 * docker inspect の State.Status / Health を正規化。
 * @param state 例: "running" | "exited" | "created" | "restarting" | "paused" | "dead"
 * @param health 例: "starting" | "healthy" | "unhealthy"(HEALTHCHECK 設定時のみ)
 * @param exitCode 終了コード(exited 時)。0 以外は異常とみなす。
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
      return exitCode && exitCode !== 0 ? "error" : "stopped";
    case "dead":
      return "error";
    default:
      return "unknown";
  }
};
