import { Rcon } from "rcon-client";
import type { Server } from "../db/schema.ts";

/**
 * RCON 経由でコマンドを送信し、結果文字列を返す(要件 FR-2 / 4-2,4-3)。
 * API と MC サーバーは同一ホストのため 127.0.0.1:<rconPort> へ接続する。
 * コマンドごとに接続→送信→切断する(状態を持たず堅牢)。
 */
export const sendRconCommand = async (
  server: Pick<Server, "rconPort" | "rconPassword">,
  command: string,
): Promise<string> => {
  const rcon = await Rcon.connect({
    host: "127.0.0.1",
    port: server.rconPort,
    password: server.rconPassword,
    timeout: 5000,
  });
  try {
    return await rcon.send(command);
  } finally {
    await rcon.end().catch(() => {
      /* 切断失敗は無視 */
    });
  }
};
