import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { servers, type Server } from "../db/schema.ts";
import { dockerService } from "../docker/service.ts";
import type { ServerStatus } from "../docker/status.ts";

/** DB のサーバー情報にライブステータスを付与した表示用ビュー。 */
export interface ServerWithStatus extends Server {
  liveStatus: ServerStatus;
}

export const getServer = (id: string): Server | undefined =>
  db.select().from(servers).where(eq(servers.id, id)).get();

const setStatusCache = (id: string, status: ServerStatus): void => {
  db.update(servers)
    .set({ statusCache: status, updatedAt: new Date() })
    .where(eq(servers.id, id))
    .run();
};

/**
 * 全サーバーを一覧し、Docker の現在状態をマージして返す。
 * 取得した状態は status_cache にも反映する(UI ポーリングの軽量化)。
 */
export const listServersWithStatus = async (): Promise<ServerWithStatus[]> => {
  const rows = db.select().from(servers).all();

  // 管理対象コンテナを一括取得して serverId→status のマップを作る。
  const statusByServerId = new Map<string, ServerStatus>();
  try {
    for (const c of await dockerService.listManaged()) {
      if (c.serverId) statusByServerId.set(c.serverId, c.status);
    }
  } catch {
    // Docker 不通時は status_cache を fallback に使う。
  }

  return rows.map((row) => {
    const live = statusByServerId.get(row.id) ?? "unknown";
    if (live !== "unknown" && live !== row.statusCache) {
      setStatusCache(row.id, live);
    }
    return { ...row, liveStatus: live };
  });
};

/** 単一サーバーのライブステータスを取得し status_cache を更新。 */
export const refreshServerStatus = async (
  id: string,
): Promise<ServerStatus> => {
  const server = getServer(id);
  if (!server?.containerId) return "unknown";
  const status = await dockerService.getStatus(server.containerId);
  setStatusCache(id, status);
  return status;
};

type Lifecycle = "start" | "stop" | "restart";

/**
 * サーバー(コンテナ)のライフサイクル操作。container_id 未割当なら null を返す。
 */
export const controlServer = async (
  id: string,
  action: Lifecycle,
): Promise<{ ok: true; status: ServerStatus } | null> => {
  const server = getServer(id);
  if (!server?.containerId) return null;

  if (action === "start") await dockerService.start(server.containerId);
  else if (action === "stop") await dockerService.stop(server.containerId);
  else await dockerService.restart(server.containerId);

  const status = await dockerService.getStatus(server.containerId);
  setStatusCache(id, status);
  return { ok: true, status };
};

/**
 * 管理対象コンテナと DB を突き合わせ、status_cache を最新化する(再起動耐性)。
 * DB に存在するサーバーの container_id がまだ無ければラベル一致で再リンクする。
 */
export const reconcileServers = async (): Promise<void> => {
  let managed: Awaited<ReturnType<typeof dockerService.listManaged>>;
  try {
    managed = await dockerService.listManaged();
  } catch {
    // Docker 不通なら何もしない(次回ポーリングで再試行)。
    return;
  }

  const byServerId = new Map(
    managed.filter((c) => c.serverId).map((c) => [c.serverId as string, c]),
  );

  for (const row of db.select().from(servers).all()) {
    const c = byServerId.get(row.id);
    if (!c) {
      // コンテナが見当たらない = 削除済み等。停止扱いにしておく。
      if (row.statusCache !== "stopped") setStatusCache(row.id, "stopped");
      continue;
    }
    const patch: Partial<Server> = {};
    if (row.containerId !== c.containerId) patch.containerId = c.containerId;
    if (row.statusCache !== c.status) patch.statusCache = c.status;
    if (Object.keys(patch).length > 0) {
      db.update(servers)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(servers.id, row.id))
        .run();
    }
  }
};
