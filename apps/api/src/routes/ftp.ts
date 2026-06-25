import { Hono } from "hono";
import { type AppEnv, requireAuth } from "../middleware/auth.ts";
import { getFtpInfo } from "../services/ftp.ts";

/** FTP 接続情報の表示 API(要件 FR-7 / 6-2)。閲覧のみ(全ロール)。 */
export const ftpRoutes = new Hono<AppEnv>();

ftpRoutes.use("*", requireAuth);

ftpRoutes.get("/", (c) => c.json({ ftp: getFtpInfo() }));
