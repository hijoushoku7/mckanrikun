import { Hono } from "hono";
import { type AppEnv, requireAuth, requireRole } from "../middleware/auth.ts";
import { dockerService } from "../docker/service.ts";
import {
  controlServer,
  getServer,
  listServersWithStatus,
  refreshServerStatus,
} from "../services/servers.ts";

/** サーバー(MC コンテナ)操作 API。 */
export const serverRoutes = new Hono<AppEnv>();

serverRoutes.use("*", requireAuth);

/** 一覧(ライブステータス付き)。全ロール閲覧可。 */
serverRoutes.get("/", async (c) => {
  const servers = await listServersWithStatus();
  return c.json({ servers });
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
  return c.json({ server: { ...server, liveStatus } });
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
