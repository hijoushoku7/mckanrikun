import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.ts";
import { startDockerReconciliation } from "./docker/bootstrap.ts";
import type { AppEnv } from "./middleware/auth.ts";
import { authRoutes } from "./routes/auth.ts";
import { serverRoutes } from "./routes/servers.ts";
import { userRoutes } from "./routes/users.ts";
import { purgeExpiredSessions } from "./services/auth.ts";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: config.webOrigin,
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api/servers", serverRoutes);

// 起動時と定期的に期限切れセッションを掃除する。
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();

// Docker コンテナの再認識・状態同期を開始(Docker 不通でも起動は継続)。
void startDockerReconciliation();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});

export type AppType = typeof app;
