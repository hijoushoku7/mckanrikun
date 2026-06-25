import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { config } from "../config.ts";
import { type AppEnv, requireAuth } from "../middleware/auth.ts";
import { destroySession, login } from "../services/auth.ts";
import { toPublicUser } from "../services/users.ts";

export const authRoutes = new Hono<AppEnv>();

/** ログイン。成功時にセッション Cookie を発行。 */
authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return c.json({ error: "username and password are required" }, 400);
  }

  const result = await login(username, password);
  if (!result) {
    return c.json({ error: "invalid credentials" }, 401);
  }

  setCookie(c, config.sessionCookieName, result.token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.cookieSecure,
    path: "/",
    maxAge: result.maxAgeSec,
  });
  return c.json({ user: toPublicUser(result.user) });
});

/** ログアウト。セッションを破棄し Cookie を削除。 */
authRoutes.post("/logout", (c) => {
  const token = getCookie(c, config.sessionCookieName);
  if (token) destroySession(token);
  deleteCookie(c, config.sessionCookieName, { path: "/" });
  return c.json({ ok: true });
});

/** 現在のログインユーザー情報。 */
authRoutes.get("/me", requireAuth, (c) => {
  return c.json({ user: toPublicUser(c.get("user")) });
});
