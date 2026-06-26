"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, LoadingState, EmptyState } from "@/components/mc";
import { toast } from "@/components/Toast";
import { ApiError, listPorts, listServers } from "@/lib/api";
import type { PortAllocation, Server } from "@/lib/types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function purposeChip(purpose: PortAllocation["purpose"]): { label: string; color: string } {
  switch (purpose) {
    case "game":
      return { label: "ゲーム", color: "var(--grass)" };
    case "rcon":
      return { label: "RCON", color: "var(--lapis)" };
    case "ftp":
      return { label: "FTP", color: "var(--gold)" };
    case "other":
    default:
      return { label: "その他", color: "var(--ink-mute)" };
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

function PurposeChip({ purpose }: { purpose: PortAllocation["purpose"] }) {
  const { label, color } = purposeChip(purpose);
  return (
    <span className="mc-chip" style={{ borderColor: color, color }}>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function PortsPage() {
  return (
    <AppShell>
      <PortsContent />
    </AppShell>
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
    if (!serverId) return "—";
    const srv = servers.find((s) => s.id === serverId);
    return srv ? srv.name : serverId;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        eyebrow="NETWORK"
        title="ポート使用状況"
        subtitle="ホストで割り当て済みのポート一覧"
        actions={
          <button type="button" className="mc-btn" onClick={() => void fetchData()}>
            更新
          </button>
        }
      />

      <Panel title="ALLOCATIONS" meta={`${allocations.length} 件`}>
        {loading ? (
          <LoadingState />
        ) : allocations.length === 0 ? (
          <EmptyState message="登録されているポートがありません" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  {["ポート", "プロトコル", "用途", "サーバー", "備考", "登録日時"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => (
                  <tr key={alloc.id}>
                    <td style={{ fontWeight: 700, fontSize: 14 }}>{alloc.port}</td>
                    <td style={{ textTransform: "uppercase", color: "var(--ink-soft)" }}>
                      {alloc.protocol}
                    </td>
                    <td>
                      <PurposeChip purpose={alloc.purpose} />
                    </td>
                    <td style={{ color: alloc.serverId ? "var(--ink)" : "var(--ink-mute)" }}>
                      {serverName(alloc.serverId)}
                    </td>
                    <td
                      style={{
                        color: "var(--ink-soft)",
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {alloc.note ?? "—"}
                    </td>
                    <td style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                      {formatDate(alloc.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
