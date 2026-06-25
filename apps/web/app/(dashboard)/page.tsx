"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/Toast";
import {
  ApiError,
  listServers,
  controlServer,
  deleteServer,
} from "@/lib/api";
import type { Server, ServerStatus } from "@/lib/types";

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
    case "stopped":
      return "var(--color-bg-elevated)";
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

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "13px",
  fontFamily: "var(--font-mono)",
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border-muted)",
  borderRadius: "4px",
  color: "var(--color-text-primary)",
  outline: "none",
  cursor: "pointer",
};

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const canOperate =
    user?.role === "admin" || user?.role === "operator";

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const data = await listServers();
      setServers(data);
    } catch {
      toast("サーバー一覧の取得に失敗しました。", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  // Polling every 10 s
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pollRef.current = setInterval(() => {
      void fetchServers();
    }, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchServers]);

  async function handleControl(
    id: string,
    action: "start" | "stop" | "restart"
  ) {
    setActionId(id);
    try {
      await controlServer(id, action);
      toast(
        `${action === "start" ? "起動" : action === "stop" ? "停止" : "再起動"}コマンドを送信しました。`,
        "success"
      );
      await fetchServers();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(`操作に失敗: ${err.message}`, "error");
      } else {
        toast("操作に失敗しました。", "error");
      }
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(server: Server) {
    if (
      !window.confirm(
        `「${server.name}」を削除しますか？この操作は元に戻せません。`
      )
    )
      return;
    setActionId(server.id);
    try {
      await deleteServer(server.id);
      toast(`「${server.name}」を削除しました。`, "success");
      await fetchServers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast("サーバーが見つかりません。", "error");
      } else if (err instanceof ApiError) {
        toast(`削除に失敗: ${err.message}`, "error");
      } else {
        toast("削除に失敗しました。", "error");
      }
    } finally {
      setActionId(null);
    }
  }

  const actionBtnStyle = (
    color: string,
    disabled: boolean
  ): React.CSSProperties => ({
    padding: "4px 10px",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    backgroundColor: "transparent",
    border: `1px solid ${disabled ? "var(--color-border-muted)" : color}`,
    borderRadius: "4px",
    color: disabled ? "var(--color-text-muted)" : color,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap" as const,
  });

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Minecraft Servers
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "var(--color-text-secondary)",
            }}
          >
            登録済みサーバーの状態確認と操作
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => void fetchServers()}
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "4px",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
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
            更新
          </button>
          {canOperate && (
            <Link
              href="/servers/new"
              style={{
                padding: "7px 16px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                backgroundColor: "var(--color-accent)",
                color: "#0d1117",
                border: "none",
                borderRadius: "4px",
                textDecoration: "none",
                display: "inline-block",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              + 新規サーバー作成
            </Link>
          )}
        </div>
      </div>

      {/* Server list */}
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Servers
          </h2>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            {servers.length} total
          </span>
        </div>

        {loading ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
            }}
          >
            Loading…
          </div>
        ) : servers.length === 0 ? (
          <div
            style={{
              padding: "64px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "28px",
                color: "var(--color-border-muted)",
                letterSpacing: "0.05em",
                marginBottom: "12px",
                userSelect: "none",
              }}
            >
              ▪ ▪ ▪
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: "var(--color-text-secondary)",
              }}
            >
              サーバーがありません
            </p>
            {canOperate && (
              <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--color-text-muted)" }}>
                右上の「新規サーバー作成」から追加できます。
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg-elevated)",
                  }}
                >
                  {[
                    "名前",
                    "状態",
                    "ローダー / バージョン",
                    "ポート",
                    "メモリ",
                    ...(canOperate ? ["操作"] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servers.map((server, idx) => {
                  const busy = actionId === server.id;
                  const isRunning = server.liveStatus === "running";
                  const isStopped = server.liveStatus === "stopped";
                  return (
                    <tr
                      key={server.id}
                      style={{
                        borderBottom:
                          idx < servers.length - 1
                            ? "1px solid var(--color-border)"
                            : "none",
                        opacity: busy ? 0.7 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {/* Name (コンソールへのリンク。全ロール閲覧可) */}
                      <td
                        style={{
                          padding: "14px 16px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Link
                          href={`/servers/${server.id}/console`}
                          style={{
                            color: "var(--color-accent)",
                            textDecoration: "none",
                          }}
                          title="コンソールを開く"
                        >
                          {server.name}
                        </Link>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <StatusBadge status={server.liveStatus} />
                      </td>

                      {/* Loader / version */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "12px",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {server.loaderType}
                        </span>
                        <span
                          style={{
                            marginLeft: "6px",
                            fontFamily: "var(--font-mono)",
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {server.mcVersion}
                          {server.loaderVersion
                            ? ` / ${server.loaderVersion}`
                            : ""}
                        </span>
                      </td>

                      {/* Ports */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          Game{" "}
                          <span style={{ color: "var(--color-text-primary)" }}>
                            {server.gamePort}
                          </span>
                          {" / "}RCON{" "}
                          <span style={{ color: "var(--color-text-primary)" }}>
                            {server.rconPort}
                          </span>
                        </span>
                      </td>

                      {/* Memory */}
                      <td
                        style={{
                          padding: "14px 16px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {server.memoryMb.toLocaleString()} MB
                      </td>

                      {/* Actions */}
                      {canOperate && (
                        <td style={{ padding: "14px 16px" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              alignItems: "center",
                            }}
                          >
                            <button
                              disabled={busy || isRunning}
                              onClick={() => void handleControl(server.id, "start")}
                              style={actionBtnStyle(
                                "var(--color-success)",
                                busy || isRunning
                              )}
                            >
                              起動
                            </button>
                            <button
                              disabled={busy || isStopped}
                              onClick={() => void handleControl(server.id, "stop")}
                              style={actionBtnStyle(
                                "var(--color-warning)",
                                busy || isStopped
                              )}
                            >
                              停止
                            </button>
                            <button
                              disabled={busy || isStopped}
                              onClick={() =>
                                void handleControl(server.id, "restart")
                              }
                              style={actionBtnStyle(
                                "var(--color-accent)",
                                busy || isStopped
                              )}
                            >
                              再起動
                            </button>
                            <Link
                              href={`/servers/${server.id}/settings`}
                              style={{
                                ...actionBtnStyle(
                                  "var(--color-text-secondary)",
                                  busy
                                ),
                                textDecoration: "none",
                                display: "inline-block",
                                pointerEvents: busy ? "none" : "auto",
                              }}
                              onMouseEnter={(e) => {
                                if (!busy) {
                                  e.currentTarget.style.borderColor =
                                    "var(--color-text-secondary)";
                                  e.currentTarget.style.color =
                                    "var(--color-text-primary)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor =
                                  "var(--color-border-muted)";
                                e.currentTarget.style.color =
                                  "var(--color-text-secondary)";
                              }}
                            >
                              設定
                            </Link>
                            <button
                              disabled={busy}
                              onClick={() => void handleDelete(server)}
                              style={actionBtnStyle(
                                "var(--color-danger)",
                                busy
                              )}
                              onMouseEnter={(e) => {
                                if (!busy)
                                  e.currentTarget.style.backgroundColor =
                                    "#3a1a1a";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
