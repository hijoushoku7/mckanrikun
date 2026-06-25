import argon2 from "argon2";
import { and, eq, gt, lt } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { sessions, users, type User } from "../db/schema.ts";
import { hashToken, newId, newSessionToken } from "../lib/crypto.ts";

/** パスワードを argon2id でハッシュ化。 */
export const hashPassword = (plain: string): Promise<string> =>
  argon2.hash(plain, { type: argon2.argon2id });

/** パスワード検証。ハッシュ不正でも例外を投げず false を返す。 */
export const verifyPassword = async (
  hash: string,
  plain: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

export interface LoginResult {
  user: User;
  /** Cookie に入れる生トークン。 */
  token: string;
  /** Cookie の Max-Age 設定用。 */
  maxAgeSec: number;
}

/** username / password を検証し、成功時に新しいセッションを発行する。 */
export const login = async (
  username: string,
  password: string,
): Promise<LoginResult | null> => {
  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user) {
    // タイミング攻撃緩和のためダミー検証を行う。
    await verifyPassword(
      "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      password,
    );
    return null;
  }
  if (!(await verifyPassword(user.passwordHash, password))) return null;

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlSec * 1000);
  db.insert(sessions)
    .values({ id: hashToken(token), userId: user.id, expiresAt })
    .run();

  return { user, token, maxAgeSec: config.sessionTtlSec };
};

/** 生トークンから有効なセッションのユーザーを取得。期限切れ/不正なら null。 */
export const resolveSession = (token: string): User | null => {
  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())),
    )
    .get();
  return row?.user ?? null;
};

/** セッションを破棄(ログアウト)。 */
export const destroySession = (token: string): void => {
  db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
};

/** 期限切れセッションの掃除。 */
export const purgeExpiredSessions = (): void => {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
};

export { newId };
