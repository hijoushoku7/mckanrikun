import { Hono } from "hono";
import { type AppEnv, requireAuth } from "../middleware/auth.ts";
import { listAllocations } from "../services/port-allocations.ts";

/** ポート使用状況の参照 API(作成ウィザードの重複回避 / Phase 6 の一覧画面で利用)。 */
export const portRoutes = new Hono<AppEnv>();

portRoutes.use("*", requireAuth);

portRoutes.get("/", (c) => c.json({ allocations: listAllocations() }));
