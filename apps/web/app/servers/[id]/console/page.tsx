"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getServer, sendConsoleCommand, WS_BASE } from "@/lib/api";
import type { Server, ServerStatus } from "@/lib/types";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const MAX_LOG_LINES = 2000;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function statusColor(s: ServerStatus): string {
  switch (s) {
    case "running":
      return "var(--color-success)";
    case "starting":
      return "var(--color-warning)";
    case "error":
      return "var(--color-danger)";
    case "stopped":
      return "var(--color-text-muted)";
    default:
      return "var(--color-border-muted)";
  }
}

function statusBg(s: ServerStatus): string {
  switch (s) {
    case "running":
      return "#1a3a20";
    case "starting":
      return "#3a2e10";
    case "error":
      return "#3a1a1a";
    default:
      return "var(--color-bg-elevated)";
  }
}

function StatusBadge({ status }: { status: ServerStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderRadius: "4px",
        backgroundColor: statusBg(status),
        color: statusColor(status),
        border: `1px solid ${statusColor(status)}`,
      }}
    >
      {status}
    </span>
  );
}

type WsState = "connecting" | "connected" | "disconnected" | "error";

interface LogEntry {
  id: number;
  text: string;
  kind: "log" | "system-error" | "system-end" | "command" | "response";
}

// ──────────────────────────────────────────────
// Page wrapper
// ──────────────────────────────────────────────

export default function ConsolePage() {
  return (
    <AuthGuard>
      <div style={{ display: "flex", minHeight: "100dvh" }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            padding: "32px",
            overflowY: "auto",
            backgroundColor: "var(--color-bg-base)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ConsoleContent />
        </main>
      </div>
    </AuthGuard>
  );
}

// ──────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────

function ConsoleContent() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const canOperate = user?.role === "admin" || user?.role === "operator";

  const [server, setServer] = useState<Server | null>(null);
  const [serverLoading, setServerLoading] = useState(true);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const [wsState, setWsState] = useState<WsState>("connecting");
  const [wsErrorMsg, setWsErrorMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const logViewRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // ── Server info ──
  useEffect(() => {
    if (!id) return;
    setServerLoading(true);
    getServer(id)
      .then((s) => setServer(s))
      .catch((err) => {
        if (err instanceof ApiError) {
          toast(`サーバー情報の取得に失敗: ${err.message}`, "error");
        } else {
          toast("サーバー情報の取得に失敗しました。", "error");
        }
      })
      .finally(() => setServerLoading(false));
  }, [id]);

  // ── Log append helper ──
  const appendLog = useCallback(
    (text: string, kind: LogEntry["kind"] = "log") => {
      setLogs((prev) => {
        const next = [
          ...prev,
          { id: ++logIdRef.current, text, kind },
        ];
        return next.length > MAX_LOG_LINES
          ? next.slice(next.length - MAX_LOG_LINES)
          : next;
      });
    },
    []
  );

  // ── WebSocket ──
  const connectWs = useCallback(() => {
    if (!id) return;

    // Clean up existing
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsState("connecting");
    setWsErrorMsg(null);

    const ws = new WebSocket(`${WS_BASE}/api/servers/${id}/logs`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState("connected");
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as {
          type: "log" | "error" | "end";
          data?: string;
          message?: string;
        };
        if (msg.type === "log" && msg.data != null) {
          appendLog(msg.data, "log");
        } else if (msg.type === "error") {
          appendLog(msg.message ?? "エラーが発生しました。", "system-error");
          setWsState("error");
          setWsErrorMsg(msg.message ?? "エラーが発生しました。");
        } else if (msg.type === "end") {
          appendLog(msg.message ?? "ログストリームが終了しました。", "system-end");
          setWsState("disconnected");
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (ev) => {
      if (wsRef.current !== ws) return; // Stale
      setWsState((prev) => (prev === "connected" ? "disconnected" : prev));
      if (!ev.wasClean && ev.code !== 1000) {
        setWsErrorMsg(
          ev.code === 1008 || ev.code === 4001
            ? "認証エラー: 再ログインしてください。"
            : "接続が切断されました。"
        );
        setWsState("disconnected");
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setWsState("error");
      setWsErrorMsg("WebSocket 接続エラーが発生しました。");
    };
  }, [id, appendLog]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs]);

  // ── Auto-scroll ──
  const handleLogScroll = useCallback(() => {
    const el = logViewRef.current;
    if (!el) return;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  useEffect(() => {
    const el = logViewRef.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  // ── Command send ──
  async function handleSendCommand(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd || sending) return;

    setSending(true);
    appendLog(`> ${cmd}`, "command");
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setCommand("");

    try {
      const response = await sendConsoleCommand(id, cmd);
      if (response) {
        appendLog(response, "response");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 502) {
          const msg = `RCON エラー: ${err.message}`;
          appendLog(msg, "system-error");
          toast(msg, "error");
        } else if (err.status === 400) {
          appendLog(`コマンドエラー: ${err.message}`, "system-error");
        } else {
          appendLog(`エラー: ${err.message}`, "system-error");
          toast(`コマンド送信に失敗: ${err.message}`, "error");
        }
      } else {
        appendLog("予期しないエラーが発生しました。", "system-error");
        toast("コマンド送信に失敗しました。", "error");
      }
    } finally {
      setSending(false);
    }
  }

  // ── Command history navigation ──
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistoryIdx((prev) => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        if (cmdHistory[next] != null) setCommand(cmdHistory[next]);
        return next;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistoryIdx((prev) => {
        const next = Math.max(prev - 1, -1);
        setCommand(next === -1 ? "" : (cmdHistory[next] ?? ""));
        return next;
      });
    }
  }

  // ── WS state indicator ──
  function WsIndicator() {
    const color =
      wsState === "connected"
        ? "var(--color-success)"
        : wsState === "connecting"
          ? "var(--color-warning)"
          : "var(--color-danger)";
    const label =
      wsState === "connected"
        ? "接続中"
        : wsState === "connecting"
          ? "接続中…"
          : "切断";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          color,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            backgroundColor: color,
          }}
        />
        {label}
      </span>
    );
  }

  // ── Log line color ──
  function logColor(kind: LogEntry["kind"]): string {
    switch (kind) {
      case "system-error":
        return "var(--color-danger)";
      case "system-end":
        return "var(--color-warning)";
      case "command":
        return "var(--color-accent)";
      case "response":
        return "#a8d8a8";
      default:
        return "#c9d1d9";
    }
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "24px" }}>
      {/* Page header */}
      <div
        style={{
          paddingBottom: "20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            <Link
              href="/"
              style={{
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              Dashboard
            </Link>
            <span>/</span>
            <span>Console</span>
          </div>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {serverLoading ? (
              <span style={{ color: "var(--color-text-muted)" }}>読み込み中…</span>
            ) : server ? (
              <>
                <span>{server.name}</span>
                <StatusBadge status={server.liveStatus} />
              </>
            ) : (
              <span style={{ color: "var(--color-danger)" }}>
                サーバーが見つかりません
              </span>
            )}
          </h1>

          {server && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {server.loaderType} {server.mcVersion}
              {server.loaderVersion ? ` / ${server.loaderVersion}` : ""}
              {"  ·  "}Game :{server.gamePort} · RCON :{server.rconPort}
            </p>
          )}
        </div>

        <WsIndicator />
      </div>

      {/* Log viewer */}
      <div
        style={{
          backgroundColor: "#0d1117",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: "420px",
          overflow: "hidden",
        }}
      >
        {/* Log toolbar */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #21262d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#161b22",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Server Log
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-muted)",
              }}
            >
              {logs.length} 行
            </span>
            <button
              onClick={() => setLogs([])}
              style={{
                padding: "3px 10px",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "transparent",
                border: "1px solid #30363d",
                borderRadius: "4px",
                color: "var(--color-text-muted)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-muted)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#30363d";
                e.currentTarget.style.color = "var(--color-text-muted)";
              }}
            >
              クリア
            </button>
          </div>
        </div>

        {/* Log content */}
        <div
          ref={logViewRef}
          onScroll={handleLogScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            lineHeight: "1.7",
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                color: "#484f58",
                paddingTop: "8px",
              }}
            >
              {wsState === "connecting"
                ? "WebSocket 接続中…"
                : "ログがありません。"}
            </div>
          ) : (
            logs.map((entry) => (
              <pre
                key={entry.id}
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: logColor(entry.kind),
                }}
              >
                {entry.text}
              </pre>
            ))
          )}
        </div>

        {/* Disconnected banner */}
        {(wsState === "disconnected" || wsState === "error") && (
          <div
            style={{
              padding: "10px 16px",
              backgroundColor: "#3a1a1a",
              borderTop: "1px solid var(--color-danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-danger)",
              }}
            >
              {wsErrorMsg ?? "切断されました。"}
            </span>
            <button
              onClick={() => {
                setLogs([]);
                connectWs();
              }}
              style={{
                padding: "4px 14px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "transparent",
                border: "1px solid var(--color-danger)",
                borderRadius: "4px",
                color: "var(--color-danger)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              再接続
            </button>
          </div>
        )}
      </div>

      {/* Command input */}
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "16px 20px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "10px",
          }}
        >
          RCON Command
          {!canOperate && (
            <span
              style={{
                marginLeft: "10px",
                fontSize: "11px",
                fontWeight: 400,
                color: "var(--color-text-muted)",
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              (閲覧専用 — コマンド送信には operator 以上が必要です)
            </span>
          )}
        </div>

        <form
          onSubmit={(e) => void handleSendCommand(e)}
          style={{ display: "flex", gap: "8px" }}
        >
          <input
            type="text"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setHistoryIdx(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              canOperate
                ? "コマンドを入力 (例: list, say Hello)"
                : "閲覧専用モード"
            }
            disabled={!canOperate || sending}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              backgroundColor: canOperate
                ? "var(--color-bg-base)"
                : "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "4px",
              color: canOperate
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
              outline: "none",
              cursor: canOperate ? "text" : "not-allowed",
            }}
            onFocus={(e) => {
              if (canOperate)
                e.currentTarget.style.borderColor = "var(--color-accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
            }}
          />
          <button
            type="submit"
            disabled={!canOperate || sending || !command.trim()}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              backgroundColor:
                !canOperate || sending || !command.trim()
                  ? "var(--color-accent-dim)"
                  : "var(--color-accent)",
              color:
                !canOperate || sending || !command.trim()
                  ? "var(--color-accent)"
                  : "#0d1117",
              border: "none",
              borderRadius: "4px",
              cursor:
                !canOperate || sending || !command.trim()
                  ? "not-allowed"
                  : "pointer",
              whiteSpace: "nowrap",
              transition: "opacity 0.15s",
            }}
          >
            {sending ? "送信中…" : "送信"}
          </button>
        </form>

        {canOperate && cmdHistory.length > 0 && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "11px",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ↑↓ キーで履歴を参照 ({cmdHistory.length} 件)
          </p>
        )}
      </div>
    </div>
  );
}
