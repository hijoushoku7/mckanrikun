import { config } from "../config.ts";
import { reconcileServers } from "../services/servers.ts";
import { dockerService } from "./service.ts";

/**
 * 起動時のコンテナ再認識 + 状態同期を開始する。
 * - 起動直後に一度 reconcile(再起動耐性)。
 * - 一定間隔でポーリング同期(イベント取りこぼしの保険)。
 * - container イベントを購読し、変化があれば即時 reconcile。
 * Docker 不通でもアプリ自体は起動を継続する(MC 管理以外の機能は使える)。
 */
export const startDockerReconciliation = async (): Promise<void> => {
  try {
    await dockerService.ping();
    console.log("[docker] connected to daemon");
  } catch (err) {
    console.warn(
      `[docker] daemon unreachable at ${config.dockerSocket}; ` +
        "will keep retrying on poll. " +
        (err instanceof Error ? err.message : ""),
    );
  }

  await reconcileServers();

  const interval = setInterval(() => {
    void reconcileServers();
  }, config.statusPollMs);
  interval.unref();

  // イベント購読(失敗しても致命的ではない。ポーリングで代替)。
  try {
    await dockerService.subscribeEvents((ev) => {
      if (ev.serverId) void reconcileServers();
    });
  } catch (err) {
    console.warn(
      "[docker] event subscription failed; relying on polling. " +
        (err instanceof Error ? err.message : ""),
    );
  }
};
