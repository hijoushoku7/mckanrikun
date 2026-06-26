"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/Toast";
import { PingBars, LoaderBlock, loaderLabel } from "@/components/PingBars";
import { Spinner } from "@/components/Spinner";
import { ApiError, listServers, controlServer, deleteServer } from "@/lib/api";
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

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: 9,
  letterSpacing: "0.1em",
  color: "var(--ink-mute)",
};

const metaText: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 12,
  color: "var(--ink-soft)",
};

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const canOperate = user?.role === "admin" || user?.role === "operator";

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
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

  // Polling every 10 s (silent — errors go to toast)
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
      !window.confirm(`「${server.name}」を削除しますか？この操作は元に戻せません。`)
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
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Page header */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={eyebrow}>SELECT SERVER</div>
          <h1
            style={{
              margin: "8px 0 4px",
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
            }}
          >
            Minecraft サーバー
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
            登録済みサーバーの状態確認と操作
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {lastUpdated && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--ink-mute)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {refreshing && <Spinner size={12} />}
              更新 {formatTime(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            className="mc-btn"
            onClick={() => void fetchServers(true)}
            disabled={refreshing || loading}
            aria-label="サーバー一覧を更新"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {refreshing && <Spinner size={12} />}
            更新
          </button>
          {canOperate && (
            <Link href="/servers/new" className="mc-btn mc-btn--grass">
              ＋ 新規サーバー
            </Link>
          )}
        </div>
      </div>

      {/* Server list — styled as the Minecraft multiplayer screen */}
      <div className="mc-panel" style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "2px solid var(--bevel-lo)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={eyebrow}>SERVERS</span>
          <span style={{ ...eyebrow, color: "var(--ink-soft)" }}>
            {servers.length} 件
          </span>
        </div>

        {loading ? (
          <div
            style={{
              padding: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              color: "var(--ink-soft)",
              fontFamily: "var(--font-data)",
              fontSize: 13,
            }}
          >
            <Spinner size={24} />
            <span>読み込み中…</span>
          </div>
        ) : fetchError ? (
          <div style={{ padding: "44px 32px", textAlign: "center" }}>
            <p
              style={{
                margin: "0 0 16px",
                fontFamily: "var(--font-data)",
                fontSize: 13,
                color: "var(--redstone)",
              }}
            >
              {fetchError}
            </p>
            <button
              type="button"
              className="mc-btn mc-btn--redstone"
              onClick={() => {
                setFetchError(null);
                initialLoadDone.current = false;
                setLoading(true);
                void fetchServers();
              }}
            >
              再試行
            </button>
          </div>
        ) : servers.length === 0 ? (
          <div style={{ padding: "64px 32px", textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                gap: 6,
                marginBottom: 16,
              }}
              aria-hidden
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: "var(--slot)",
                    border: "2px solid var(--outline)",
                  }}
                />
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink)" }}>
              サーバーがありません
            </p>
            {canOperate && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
                右上の「新規サーバー」から追加できます。
              </p>
            )}
          </div>
        ) : (
          <div>
            {servers.map((server, idx) => {
              const busy = actionId === server.id;
              const isRunning = server.liveStatus === "running";
              const isStopped = server.liveStatus === "stopped";
              return (
                <div
                  key={server.id}
                  className="server-row"
                  style={{
                    padding: "14px 18px",
                    borderBottom:
                      idx < servers.length - 1 ? "2px solid var(--bevel-lo)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                    opacity: busy ? 0.65 : 1,
                  }}
                >
                  <LoaderBlock loader={server.loaderType} />

                  {/* Identity */}
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Link
                        href={`/servers/${server.id}/console`}
                        title="コンソールを開く"
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: "var(--ink)",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--grass-lo)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--ink)";
                        }}
                      >
                        {server.name}
                      </Link>
                      {busy && <Spinner size={12} />}
                    </div>
                    <div
                      style={{
                        ...metaText,
                        display: "flex",
                        gap: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        <span style={{ color: "var(--ink)" }}>
                          {loaderLabel(server.loaderType)}
                        </span>{" "}
                        {server.mcVersion}
                        {server.loaderVersion ? ` / ${server.loaderVersion}` : ""}
                      </span>
                      <span>
                        :
                        <span style={{ color: "var(--ink)" }}>{server.gamePort}</span>
                        <span style={{ color: "var(--ink-mute)" }}> · rcon </span>
                        <span style={{ color: "var(--ink)" }}>{server.rconPort}</span>
                      </span>
                      <span>
                        <span style={{ color: "var(--ink)" }}>
                          {server.memoryMb.toLocaleString()}
                        </span>{" "}
                        MB
                      </span>
                    </div>
                  </div>

                  {/* Live status */}
                  <PingBars status={server.liveStatus} />

                  {/* Actions */}
                  {canOperate && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="mc-btn mc-btn--grass"
                        style={{ fontSize: 12, padding: "6px 11px" }}
                        disabled={busy || isRunning}
                        onClick={() => void handleControl(server.id, "start")}
                        aria-label={`${server.name} を起動`}
                      >
                        起動
                      </button>
                      <button
                        type="button"
                        className="mc-btn mc-btn--gold"
                        style={{ fontSize: 12, padding: "6px 11px" }}
                        disabled={busy || isStopped}
                        onClick={() => void handleControl(server.id, "stop")}
                        aria-label={`${server.name} を停止`}
                      >
                        停止
                      </button>
                      <button
                        type="button"
                        className="mc-btn"
                        style={{ fontSize: 12, padding: "6px 11px" }}
                        disabled={busy || isStopped}
                        onClick={() => void handleControl(server.id, "restart")}
                        aria-label={`${server.name} を再起動`}
                      >
                        再起動
                      </button>
                      <Link
                        href={`/servers/${server.id}/settings`}
                        className="mc-btn"
                        style={{
                          fontSize: 12,
                          padding: "6px 11px",
                          pointerEvents: busy ? "none" : "auto",
                          opacity: busy ? 0.45 : 1,
                        }}
                      >
                        設定
                      </Link>
                      <button
                        type="button"
                        className="mc-btn mc-btn--redstone"
                        style={{ fontSize: 12, padding: "6px 11px" }}
                        disabled={busy}
                        onClick={() => void handleDelete(server)}
                        aria-label={`${server.name} を削除`}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
