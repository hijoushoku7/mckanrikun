"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PingBars } from "@/components/PingBars";
import { toast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { ApiError, MOCK_API_ENABLED, getServer, sendConsoleCommand, WS_BASE } from "@/lib/api";
import type { Server } from "@/lib/types";

const MAX_LOG_LINES = 2000;

type WsState = "connecting" | "connected" | "disconnected" | "error";

interface LogEntry {
  id: number;
  text: string;
  kind: "log" | "system-error" | "system-end" | "command" | "response";
}

export default function ConsolePage() {
  return (
    <AppShell>
      <ConsoleContent />
    </AppShell>
  );
}

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

  // ── ステータスの軽量ポーリング(操作後の状態変化を反映) ──
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      getServer(id)
        .then((s) =>
          setServer((prev) =>
            prev ? { ...prev, liveStatus: s.liveStatus } : s
          )
        )
        .catch(() => {
          // ポーリング失敗は無視(次回再試行)。
        });
    }, 5000);
    return () => clearInterval(t);
  }, [id]);

  // ── Log append helper ──
  const appendLog = useCallback((text: string, kind: LogEntry["kind"] = "log") => {
    setLogs((prev) => {
      const next = [...prev, { id: ++logIdRef.current, text, kind }];
      return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
    });
  }, []);

  // ── WebSocket ──
  const connectWs = useCallback(() => {
    if (!id) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsState("connecting");
    setWsErrorMsg(null);

    if (MOCK_API_ENABLED) {
      const lines = [
        "[09:00:00] [Server thread/INFO]: Starting minecraft server mock",
        "[09:00:01] [Server thread/INFO]: Loading properties",
        '[09:00:02] [Server thread/INFO]: Preparing level "world"',
        '[09:00:03] [Server thread/INFO]: Done (2.345s)! For help, type "help"',
      ];
      setWsState("connected");
      lines.forEach((line, index) => {
        window.setTimeout(() => appendLog(line, "log"), 250 * (index + 1));
      });
      return;
    }

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
      if (wsRef.current !== ws) return;
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
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
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
        setCommand(next === -1 ? "" : cmdHistory[next] ?? "");
        return next;
      });
    }
  }

  // ── WS state indicator ──
  function WsIndicator() {
    const color =
      wsState === "connected"
        ? "var(--grass)"
        : wsState === "connecting"
          ? "var(--gold)"
          : "var(--redstone)";
    const label =
      wsState === "connected" ? "接続済み" : wsState === "connecting" ? "接続中…" : "切断";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12,
          fontFamily: "var(--font-data)",
          color,
        }}
        aria-live="polite"
        aria-label={`WebSocket: ${label}`}
      >
        {wsState === "connecting" ? (
          <Spinner size={10} />
        ) : (
          <span style={{ display: "inline-block", width: 8, height: 8, backgroundColor: color, border: "1px solid var(--outline)" }} />
        )}
        {label}
      </span>
    );
  }

  // ── Log line color (tuned for the dark obsidian screen) ──
  function logColor(kind: LogEntry["kind"]): string {
    switch (kind) {
      case "system-error":
        return "#ff8f7e";
      case "system-end":
        return "#e6b94f";
      case "command":
        return "#8fd06a";
      case "response":
        return "#9fd98a";
      default:
        return "#d8d0c0";
    }
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 72px)", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              fontSize: 12,
              fontFamily: "var(--font-data)",
              color: "var(--ink-mute)",
            }}
          >
            <Link href="/" className="mc-link" style={{ fontWeight: 400 }}>
              ダッシュボード
            </Link>
            <span>/</span>
            <span>コンソール</span>
          </div>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: "var(--ink)",
              letterSpacing: "-0.015em",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {serverLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-mute)" }}>
                <Spinner size={16} />
                読み込み中…
              </span>
            ) : server ? (
              <>
                <span>{server.name}</span>
                <PingBars status={server.liveStatus} />
              </>
            ) : (
              <span style={{ color: "var(--redstone)" }}>サーバーが見つかりません</span>
            )}
          </h1>

          {server && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", fontFamily: "var(--font-data)" }}>
              {server.loaderType} {server.mcVersion}
              {server.loaderVersion ? ` / ${server.loaderVersion}` : ""}
              {"  ·  "}Game :{server.gamePort} · RCON :{server.rconPort}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {server && (
            <Link
              href={`/servers/${id}/settings`}
              style={{
                padding: "7px 14px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "transparent",
                border: "1px solid var(--color-border-muted)",
                borderRadius: "4px",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                display: "inline-block",
                transition: "border-color 0.15s, color 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.color = "var(--color-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-muted)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              ← 設定
            </Link>
          )}
          <WsIndicator />
        </div>
      </div>

      {/* Log viewer — an obsidian screen set into the sandstone console */}
      <div
        className="mc-panel"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 420, overflow: "hidden" }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "2px solid var(--bevel-lo)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span className="mc-eyebrow">SERVER LOG</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mc-eyebrow" style={{ color: "var(--ink-soft)" }}>{logs.length} 行</span>
            <button type="button" className="mc-btn" onClick={() => setLogs([])} style={{ fontSize: 11, padding: "5px 10px" }}>
              クリア
            </button>
          </div>
        </div>

        {/* Screen */}
        <div
          ref={logViewRef}
          onScroll={handleLogScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            fontFamily: "var(--font-data)",
            fontSize: 12,
            lineHeight: 1.7,
            backgroundColor: "#17140f",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: "#7a7363", paddingTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              {wsState === "connecting" && <Spinner size={12} />}
              {wsState === "connecting" ? "WebSocket 接続中…" : "ログがありません。"}
            </div>
          ) : (
            logs.map((entry) => (
              <pre
                key={entry.id}
                style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", color: logColor(entry.kind) }}
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
              backgroundColor: "var(--redstone-lo)",
              borderTop: "2px solid var(--outline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "#ffd9d3" }}>
              {wsErrorMsg ?? "切断されました。"}
            </span>
            <button
              type="button"
              className="mc-btn"
              onClick={() => {
                setLogs([]);
                connectWs();
              }}
              style={{ fontSize: 12, padding: "5px 14px", flexShrink: 0 }}
            >
              再接続
            </button>
          </div>
        )}
      </div>

      {/* Command input */}
      <div className="mc-panel" style={{ padding: "16px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
          <span className="mc-eyebrow">RCON COMMAND</span>
          {!canOperate && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-data)" }}>
              (閲覧専用 — コマンド送信には operator 以上が必要です)
            </span>
          )}
        </div>

        <form onSubmit={(e) => void handleSendCommand(e)} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            className="mc-input"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setHistoryIdx(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={canOperate ? "コマンドを入力 (例: list, say Hello)" : "閲覧専用モード"}
            disabled={!canOperate || sending}
            style={{ flex: 1, opacity: canOperate ? 1 : 0.6 }}
          />
          <button
            type="submit"
            className="mc-btn mc-btn--grass"
            disabled={!canOperate || sending || !command.trim()}
          >
            {sending ? "送信中…" : "送信"}
          </button>
        </form>

        {canOperate && cmdHistory.length > 0 && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-data)" }}>
            ↑↓ キーで履歴を参照 ({cmdHistory.length} 件)
          </p>
        )}
      </div>
    </div>
  );
}
