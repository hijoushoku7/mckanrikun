import Docker from "dockerode";
import { config } from "../config.ts";

/**
 * Docker Engine API クライアント(Unix ソケット接続)。
 * 単一ホスト運用のため socketPath 固定。リモート(SSH/TCP)は非対応。
 */
export const docker = new Docker({ socketPath: config.dockerSocket });

/** Docker デーモンへの疎通確認。失敗時は例外。 */
export const pingDocker = async (): Promise<void> => {
  await docker.ping();
};
