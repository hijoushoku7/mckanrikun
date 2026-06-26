"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import {
  ApiError,
  listServers,
  controlServer,
  deleteServer,
} from "@/lib/api";
import type { Server } from "@/lib/types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const canOperate =
    user?.role === "admin" || user?.role === "operator";

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  // 初回ロード済みかを ref で追跡(useCallback の依存に loading を入れず済む)
  const initialLoadDone = useRef(false);

  const fetchServers = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setFetchError(null);
    try {
      const data = await listServers();
      setServers(data);
      setLastUpdated(new Date());
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `サーバー一覧の取得に失敗しました: ${err.message}`
          : "サーバー一覧の取得に失敗しました。";
      // 初回ロードが終わっていない場合はインライン表示、以降はトースト
      if (!initialLoadDone.current) {
        setFetchError(msg);
      } else {
        toast(msg, "error");
      }
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      if (manual) setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  // Polling every 10 s (silent — errors go to toast, not blocking)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pollRef.current = setInterval(() => {
      void fetchServers();
    }, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchServers]);

  // 操作直後は状態が確定するまで数秒間だけ短間隔で再取得する。
  // 通常の 10 秒ポーリングだと start/stop の遷移完了が最大 10 秒反映されない。
  const burstRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startBurstPoll = useCallback(() => {
    if (burstRef.current) clearTimeout(burstRef.current);
    let count = 0;
    const tick = () => {
      void fetchServers();
      count += 1;
      burstRef.current = count < 8 ? setTimeout(tick, 2000) : null;
    };
    burstRef.current = setTimeout(tick, 1500);
  }, [fetchServers]);
  useEffect(
    () => () => {
      if (burstRef.current) clearTimeout(burstRef.current);
    },
    []
  );

  async function handleControl(
    id: string,
    action: "start" | "stop" | "restart"
  ) {
    setActionId(id);
    // 楽観的更新: コマンド送出と同時にバッジを過渡状態へ。
    const optimistic: Server["liveStatus"] =
      action === "stop" ? "stopping" : "starting";
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, liveStatus: optimistic } : s))
    );
    try {
      await controlServer(id, action);
      toast(
        `${action === "start" ? "起動" : action === "stop" ? "停止" : "再起動"}コマンドを送信しました。`,
        "success"
      );
      // 状態が確定するまで短間隔で追従。
      startBurstPoll();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(`操作に失敗: ${err.message}`, "error");
      } else {
        toast("操作に失敗しました。", "error");
      }
      // 失敗時は楽観的更新を実状態へ戻す。
      await fetchServers();
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
          {/* 最終更新時刻 + 更新中インジケータ */}
          {lastUpdated && (
            <span
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {refreshing && <Spinner size={12} />}
              更新 {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => void fetchServers(true)}
            disabled={refreshing || loading}
            aria-label="サーバー一覧を更新"
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "4px",
              color: refreshing || loading ? "var(--color-text-muted)" : "var(--color-text-secondary)",
              cursor: refreshing || loading ? "not-allowed" : "pointer",
              opacity: refreshing || loading ? 0.6 : 1,
              transition: "border-color 0.15s, color 0.15s, opacity 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              if (!refreshing && !loading) {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.color = "var(--color-accent)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
              e.currentTarget.style.color = refreshing || loading
                ? "var(--color-text-muted)"
                : "var(--color-text-secondary)";
            }}
          >
            {refreshing && <Spinner size={12} />}
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              color: "var(--color-text-secondary)",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
            }}
          >
            <Spinner size={24} />
            <span>読み込み中…</span>
          </div>
        ) : fetchError ? (
          /* 初回取得失敗 */
          <div
            style={{
              padding: "40px 32px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-danger)",
              }}
            >
              {fetchError}
            </p>
            <button
              onClick={() => {
                setFetchError(null);
                initialLoadDone.current = false;
                setLoading(true);
                void fetchServers();
              }}
              style={{
                padding: "7px 18px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "transparent",
                border: "1px solid var(--color-danger)",
                borderRadius: "4px",
                color: "var(--color-danger)",
                cursor: "pointer",
              }}
            >
              再試行
            </button>
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
                      {/* Name */}
                      <td
                        style={{
                          padding: "14px 16px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                          {busy && <Spinner size={12} />}
                        </div>
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
                              aria-label={`${server.name} を起動`}
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
                              aria-label={`${server.name} を停止`}
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
                              aria-label={`${server.name} を再起動`}
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
                              aria-label={`${server.name} を削除`}
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
