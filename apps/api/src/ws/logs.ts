import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "../config.ts";
import { dockerService } from "../docker/service.ts";
import { resolveSession } from "../services/auth.ts";
import { getServer } from "../services/servers.ts";

/** Cookie ヘッダから指定名の値を取り出す。 */
const readCookie = (header: string | undefined, name: string): string | null => {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
};

const LOGS_PATH = /^\/api\/servers\/([^/]+)\/logs\/?$/;

/**
 * ログストリーム用 WebSocket を HTTP サーバーにアタッチする(要件 FR-2)。
 * パス /api/servers/:id/logs。セッション Cookie で認証(未認証は拒否)。
 * 認証済みなら全ロール閲覧可、コマンド送信(RCON)は別途 REST + operator 権限で行う。
 */
export const setupLogsWebSocket = (server: HttpServer): void => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url ?? "";
    const match = LOGS_PATH.exec(url.split("?")[0] ?? "");
    if (!match) {
      // 管理対象外のパスへの upgrade は破棄。
      socket.destroy();
      return;
    }

    const token = readCookie(req.headers.cookie, config.sessionCookieName);
    const user = token ? resolveSession(token) : null;
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const serverId = decodeURIComponent(match[1] ?? "");
    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleConnection(ws, serverId);
    });
  });
};

const handleConnection = async (
  ws: WebSocket,
  serverId: string,
): Promise<void> => {
  const server = getServer(serverId);
  if (!server) {
    ws.send(JSON.stringify({ type: "error", message: "server not found" }));
    ws.close();
    return;
  }
  if (!server.containerId) {
    ws.send(
      JSON.stringify({ type: "error", message: "server has no container" }),
    );
    ws.close();
    return;
  }

  let stop: (() => void) | null = null;
  try {
    stop = await dockerService.streamLogs(
      server.containerId,
      { tail: 200 },
      (text) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "log", data: text }));
        }
      },
      (err) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              type: "end",
              message: err ? err.message : "stream ended",
            }),
          );
          ws.close();
        }
      },
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: err instanceof Error ? err.message : "failed to stream logs",
      }),
    );
    ws.close();
    return;
  }

  ws.on("close", () => stop?.());
  ws.on("error", () => stop?.());
};
