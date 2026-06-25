"use client";

import type { ServerStatus } from "@/lib/types";

export function statusColor(s: ServerStatus): string {
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

export function statusBg(s: ServerStatus): string {
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

export function StatusBadge({ status }: { status: ServerStatus }) {
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
