import { createHash, randomBytes, randomUUID } from "node:crypto";

/** UUID v4 を生成。 */
export const newId = (): string => randomUUID();

/** 不透明なセッショントークン(256bit, URL セーフ)を生成。 */
export const newSessionToken = (): string =>
  randomBytes(32).toString("base64url");

/**
 * セッショントークンのルックアップキー。
 * Cookie には生トークンを入れ、DB にはこのハッシュのみ保存することで
 * DB 漏洩時に有効なトークンが直接流出しないようにする。
 */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
