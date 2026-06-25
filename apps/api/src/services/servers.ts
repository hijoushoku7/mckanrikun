import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { servers, type Server } from "../db/schema.ts";
import { dockerService } from "../docker/service.ts";
import type { ServerStatus } from "../docker/status.ts";
import { newId, newSessionToken } from "../lib/crypto.ts";
import { buildItzgSpec } from "./itzg.ts";
import { resolveJavaTag } from "./java-tags.ts";
import {
  allocatePorts,
  releasePortsForServer,
} from "./port-allocations.ts";

/** DB のサーバー情報にライブステータスを付与した表示用ビュー。 */
export interface ServerWithStatus extends Server {
  liveStatus: ServerStatus;
}

export interface CreateServerInput {
  name: string;
  loaderType: Server["loaderType"];
  mcVersion: string;
  loaderVersion: string | null;
  memoryMb: number;
  gamePort: number;
  rconPort: number;
}

/**
 * 新規 MC サーバーを作成する(要件 §9 Phase 3)。
 * ポート確保 → データディレクトリ作成 → itzg イメージ pull → コンテナ生成 → 起動、
 * の順で行い、途中失敗時はポート解放と DB 行削除でロールバックする。
 * 呼び出し前にバリデーション(EULA 同意・ポート重複・必須項目)済みであること。
 */
export const createServer = async (
  input: CreateServerInput,
): Promise<Server> => {
  const id = newId();
  const javaTag = resolveJavaTag(input.mcVersion, input.loaderType);
  // RCON パスワードはランダム生成(URL セーフ)。
  const rconPassword = newSessionToken();
  const now = new Date();

  const row: Server = {
    id,
    name: input.name,
    loaderType: input.loaderType,
    mcVersion: input.mcVersion,
    loaderVersion: input.loaderVersion,
    javaTag,
    memoryMb: input.memoryMb,
    gamePort: input.gamePort,
    rconPort: input.rconPort,
    rconPassword,
    containerId: null,
    eulaAccepted: true,
    statusCache: "starting",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(servers).values(row).run();
  allocatePorts(
    id,
    [
      { port: input.gamePort, protocol: "tcp", purpose: "game" },
      { port: input.rconPort, protocol: "tcp", purpose: "rcon" },
    ],
    input.name,
  );

  try {
    const dataDir = resolve(process.cwd(), config.serverDataRoot, id);
    mkdirSync(dataDir, { recursive: true });

    const spec = buildItzgSpec({
      id,
      name: input.name,
      loaderType: input.loaderType,
      mcVersion: input.mcVersion,
      loaderVersion: input.loaderVersion,
      javaTag,
      memoryMb: input.memoryMb,
      gamePort: input.gamePort,
      rconPort: input.rconPort,
      rconPassword,
    });

    await dockerService.pullImage(spec.image);
    const containerId = await dockerService.create(spec);
    await dockerService.start(containerId);

    db.update(servers)
      .set({ containerId, statusCache: "starting", updatedAt: new Date() })
      .where(eq(servers.id, id))
      .run();

    return { ...row, containerId };
  } catch (err) {
    // ロールバック: 確保したポートと DB 行を取り消す。
    releasePortsForServer(id);
    db.delete(servers).where(eq(servers.id, id)).run();
    throw err instanceof Error ? err : new Error("server creation failed");
  }
};

/**
 * サーバーを削除する。コンテナを強制削除し、ポート確保を解放、DB 行を削除する。
 * /data(ホストバインド)は残す(誤削除防止。クリーンアップは FTP 等で運用)。
 */
export const deleteServer = async (id: string): Promise<boolean> => {
  const server = getServer(id);
  if (!server) return false;
  if (server.containerId) {
    try {
      await dockerService.remove(server.containerId, { force: true });
    } catch {
      // コンテナが既に無い場合等は無視して DB 整合を優先。
    }
  }
  releasePortsForServer(id);
  db.delete(servers).where(eq(servers.id, id)).run();
  return true;
};

/** Server 行から itzg コンテナ生成用の入力を組み立てる。 */
const inputFromRow = (row: Server): Parameters<typeof buildItzgSpec>[0] => ({
  id: row.id,
  name: row.name,
  loaderType: row.loaderType,
  mcVersion: row.mcVersion,
  loaderVersion: row.loaderVersion,
  javaTag: row.javaTag,
  memoryMb: row.memoryMb,
  gamePort: row.gamePort,
  rconPort: row.rconPort,
  rconPassword: row.rconPassword,
});

export interface UpdateServerInput {
  name?: string;
  memoryMb?: number;
}

/**
 * サーバー設定の更新(要件 6-3: メモリ割当の編集反映)。
 * - name の変更は DB のみ反映。
 * - memoryMb の変更は、コンテナのメモリ上限と JVM 最大ヒープ(env)を反映するため
 *   コンテナを再作成する(削除→新スペックで生成→起動)。/data はバインドのため保持。
 * 再作成に失敗した場合は container_id を null・status を error にして例外を投げる。
 */
export const updateServer = async (
  id: string,
  input: UpdateServerInput,
): Promise<Server | null> => {
  const server = getServer(id);
  if (!server) return null;

  const patch: Partial<Server> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;

  const memoryChanged =
    input.memoryMb !== undefined && input.memoryMb !== server.memoryMb;
  if (input.memoryMb !== undefined) patch.memoryMb = input.memoryMb;

  // メモリ変更があり稼働コンテナがある場合は再作成して反映。
  if (memoryChanged && server.containerId) {
    const updatedRow: Server = { ...server, ...patch } as Server;
    try {
      await dockerService.remove(server.containerId, { force: true });
      const spec = buildItzgSpec(inputFromRow(updatedRow));
      const containerId = await dockerService.create(spec);
      await dockerService.start(containerId);
      patch.containerId = containerId;
      patch.statusCache = "starting";
    } catch (err) {
      db.update(servers)
        .set({ ...patch, containerId: null, statusCache: "error" })
        .where(eq(servers.id, id))
        .run();
      throw err instanceof Error ? err : new Error("failed to apply memory");
    }
  }

  db.update(servers).set(patch).where(eq(servers.id, id)).run();
  return { ...server, ...patch };
};

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
