import { eq } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { portAllocations } from "../db/schema.ts";

export interface FtpInfo {
  host: string;
  port: number;
  user: string;
  /** ルートからの mods 配置パステンプレート(:id を server-id に置換)。 */
  modsPathTemplate: string;
}

/** 画面表示用の FTP 接続情報(要件 FR-7 / 6-2)。 */
export const getFtpInfo = (): FtpInfo => ({
  host: config.ftpHost,
  port: config.ftpPort,
  user: config.ftpUser,
  modsPathTemplate: config.ftpModsPathTemplate,
});

/** 指定サーバーの mods 配置先 FTP パス。 */
export const ftpModsPath = (serverId: string): string =>
  config.ftpModsPathTemplate.replace(":id", serverId);

/**
 * FTP ポートを PortAllocation に冪等登録する(ポート使用状況一覧に表示 / 6-4)。
 * 起動時に呼ぶ。サーバー非依存(server_id = null, purpose = ftp)。
 */
export const ensureFtpPortAllocation = (): void => {
  const existing = db
    .select()
    .from(portAllocations)
    .where(eq(portAllocations.purpose, "ftp"))
    .all();
  if (existing.some((a) => a.port === config.ftpPort)) return;

  db.insert(portAllocations)
    .values({
      port: config.ftpPort,
      protocol: "tcp",
      purpose: "ftp",
      serverId: null,
      note: "FTP (MOD 配置)",
    })
    .run();
};
