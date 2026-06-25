import { Hono } from "hono";
import type { Server } from "../db/schema.ts";
import { type AppEnv, requireAuth, requireRole } from "../middleware/auth.ts";
import { dockerService } from "../docker/service.ts";
import {
  controlServer,
  createServer,
  deleteServer,
  getServer,
  listServersWithStatus,
  refreshServerStatus,
} from "../services/servers.ts";
import {
  findPortConflicts,
  isValidPort,
} from "../services/port-allocations.ts";

type LoaderType = Server["loaderType"];
const LOADERS: LoaderType[] = ["VANILLA", "FORGE", "NEOFORGE", "FABRIC"];

/** rcon_password など秘匿フィールドをレスポンスから除外する。 */
const sanitize = <T extends { rconPassword: string }>(
  server: T,
): Omit<T, "rconPassword"> => {
  const { rconPassword: _omit, ...rest } = server;
  return rest;
};

/** サーバー(MC コンテナ)操作 API。 */
export const serverRoutes = new Hono<AppEnv>();

serverRoutes.use("*", requireAuth);

/** 一覧(ライブステータス付き)。全ロール閲覧可。 */
serverRoutes.get("/", async (c) => {
  const servers = await listServersWithStatus();
  return c.json({ servers: servers.map(sanitize) });
});

/**
 * 新規サーバー作成(作成ウィザード)。operator 以上。
 * バリデーション: 必須項目 / EULA 同意 / ポート妥当性・重複。
 */
serverRoutes.post("/", requireRole("admin", "operator"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const loaderType = body?.loaderType;
  const mcVersion = typeof body?.mcVersion === "string" ? body.mcVersion : "";
  const loaderVersion =
    typeof body?.loaderVersion === "string" && body.loaderVersion
      ? body.loaderVersion
      : null;
  const memoryMb = body?.memoryMb;
  const gamePort = body?.gamePort;
  const rconPort = body?.rconPort;
  const eulaAccepted = body?.eulaAccepted === true;

  if (!name) return c.json({ error: "name is required" }, 400);
  if (!LOADERS.includes(loaderType)) {
    return c.json({ error: "invalid loaderType" }, 400);
  }
  if (!mcVersion) return c.json({ error: "mcVersion is required" }, 400);
  if (loaderType !== "VANILLA" && !loaderVersion) {
    return c.json({ error: "loaderVersion is required for this loader" }, 400);
  }
  if (!eulaAccepted) {
    return c.json({ error: "EULA must be accepted" }, 400);
  }
  if (
    typeof memoryMb !== "number" ||
    !Number.isInteger(memoryMb) ||
    memoryMb < 512 ||
    memoryMb > 65536
  ) {
    return c.json({ error: "memoryMb must be an integer in [512, 65536]" }, 400);
  }
  if (!isValidPort(gamePort) || !isValidPort(rconPort)) {
    return c.json({ error: "ports must be integers in [1024, 65535]" }, 400);
  }
  if (gamePort === rconPort) {
    return c.json({ error: "gamePort and rconPort must differ" }, 400);
  }

  const conflicts = findPortConflicts([
    { port: gamePort, protocol: "tcp", purpose: "game" },
    { port: rconPort, protocol: "tcp", purpose: "rcon" },
  ]);
  if (conflicts.length > 0) {
    return c.json({ error: "port already in use", conflicts }, 409);
  }

  try {
    const server = await createServer({
      name,
      loaderType,
      mcVersion,
      loaderVersion,
      memoryMb,
      gamePort,
      rconPort,
    });
    // RCON パスワードはレスポンスに含めない。
    return c.json({ server: sanitize(server) }, 201);
  } catch (err) {
    return c.json(
      {
        error: "failed to create server",
        detail: err instanceof Error ? err.message : undefined,
      },
      502,
    );
  }
});

/** Docker デーモン疎通確認(admin)。 */
serverRoutes.get("/_docker/ping", requireRole("admin"), async (c) => {
  try {
    await dockerService.ping();
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : "unreachable" },
      503,
    );
  }
});

/** 単一サーバー詳細 + 最新ステータス。 */
serverRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const server = getServer(id);
  if (!server) return c.json({ error: "not found" }, 404);
  const liveStatus = await refreshServerStatus(id);
  return c.json({ server: { ...sanitize(server), liveStatus } });
});

/** サーバー削除(コンテナ削除 + ポート解放 + DB 行削除)。operator 以上。 */
serverRoutes.delete("/:id", requireRole("admin", "operator"), async (c) => {
  const id = c.req.param("id");
  try {
    const ok = await deleteServer(id);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      502,
    );
  }
});

/** 起動/停止/再起動。operator 以上。 */
serverRoutes.post(
  "/:id/:action{start|stop|restart}",
  requireRole("admin", "operator"),
  async (c) => {
    const id = c.req.param("id");
    const action = c.req.param("action") as "start" | "stop" | "restart";
    if (!getServer(id)) return c.json({ error: "not found" }, 404);

    try {
      const result = await controlServer(id, action);
      if (!result) {
        return c.json({ error: "server has no container" }, 409);
      }
      return c.json(result);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "docker error" },
        502,
      );
    }
  },
);
