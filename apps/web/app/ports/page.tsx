"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { ApiError, listPorts, listServers } from "@/lib/api";
import type { PortAllocation, Server } from "@/lib/types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function purposeLabel(
  purpose: PortAllocation["purpose"]
): { label: string; color: string; bg: string } {
  switch (purpose) {
    case "game":
      return { label: "ゲーム", color: "var(--color-success)", bg: "#1a3a20" };
    case "rcon":
      return { label: "RCON", color: "var(--color-accent)", bg: "var(--color-accent-dim)" };
    case "ftp":
      return { label: "FTP", color: "var(--color-warning)", bg: "#3a2e10" };
    case "other":
    default:
      return { label: "その他", color: "var(--color-text-muted)", bg: "var(--color-bg-elevated)" };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PurposeBadge({ purpose }: { purpose: PortAllocation["purpose"] }) {
  const { label, color, bg } = purposeLabel(purpose);
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
        backgroundColor: bg,
        color: color,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function PortsPage() {
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
          }}
        >
          <PortsContent />
        </main>
      </div>
    </AuthGuard>
  );
}

function PortsContent() {
  const [allocations, setAllocations] = useState<PortAllocation[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ports, srvList] = await Promise.all([listPorts(), listServers()]);
      // ポート昇順ソート
      const sorted = [...ports].sort((a, b) => a.port - b.port);
      setAllocations(sorted);
      setServers(srvList);
    } catch (err) {
      if (err instanceof ApiError) {
        toast(`ポート一覧の取得に失敗しました: ${err.message}`, "error");
      } else {
        toast("ポート一覧の取得に失敗しました。", "error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function serverName(serverId: string | null): string {
    if (!serverId) return "-";
    const srv = servers.find((s) => s.id === serverId);
    return srv ? srv.name : serverId;
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    textAlign: "left",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    color: "var(--color-text-primary)",
    whiteSpace: "nowrap",
  };

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
            ポート使用状況
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "var(--color-text-secondary)",
            }}
          >
            ホストで割り当て済みのポート一覧
          </p>
        </div>
        <button
          onClick={() => void fetchData()}
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
      </div>

      {/* Table card */}
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
            Allocations
          </h2>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            {allocations.length} total
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
        ) : allocations.length === 0 ? (
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
              登録されているポートがありません
            </p>
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
                  {["ポート", "プロトコル", "用途", "サーバー", "備考", "登録日時"].map(
                    (h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc, idx) => (
                  <tr
                    key={alloc.id}
                    style={{
                      borderBottom:
                        idx < allocations.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {alloc.port}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textTransform: "uppercase",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {alloc.protocol}
                    </td>
                    <td style={tdStyle}>
                      <PurposeBadge purpose={alloc.purpose} />
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: alloc.serverId
                          ? "var(--color-text-primary)"
                          : "var(--color-text-muted)",
                      }}
                    >
                      {serverName(alloc.serverId)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--color-text-secondary)",
                        maxWidth: "240px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {alloc.note ?? "-"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--color-text-secondary)",
                        fontSize: "12px",
                      }}
                    >
                      {formatDate(alloc.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
