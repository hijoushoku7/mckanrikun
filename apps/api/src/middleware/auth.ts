import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { config } from "../config.ts";
import type { Role, User } from "../db/schema.ts";
import { resolveSession } from "../services/auth.ts";

/** Hono コンテキストの型拡張(認証済みユーザーを格納)。 */
export interface AppEnv {
  Variables: {
    user: User;
  };
}

/**
 * セッション Cookie を検証し、ユーザーをコンテキストへ格納する。
 * 未認証なら 401 を返す。これ以降のハンドラは c.get("user") を信頼できる。
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, config.sessionCookieName);
  const user = token ? resolveSession(token) : null;
  if (!user) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("user", user);
  await next();
});

/**
 * 指定ロールのいずれかを持つことを要求する。requireAuth の後段で使う。
 * ロールは admin > operator > viewer の包含関係ではなく、明示列挙で判定する。
 */
export const requireRole = (...allowed: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!allowed.includes(user.role)) {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  });
