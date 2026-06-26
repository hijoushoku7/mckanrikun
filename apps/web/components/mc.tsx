"use client";

import type { ReactNode } from "react";
import { Spinner } from "@/components/Spinner";

/** Page header: pixel eyebrow + big title + subtitle + optional right-side actions. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
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
        {eyebrow && <div className="mc-eyebrow">{eyebrow}</div>}
        <h1
          style={{
            margin: "8px 0 4px",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Beveled sandstone panel with an optional pixel header strip. */
export function Panel({
  title,
  meta,
  padded = false,
  children,
  style,
}: {
  title?: string;
  meta?: ReactNode;
  padded?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="mc-panel" style={{ overflow: "hidden", ...style }}>
      {(title || meta != null) && (
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "2px solid var(--bevel-lo)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span className="mc-eyebrow">{title}</span>
          {meta != null && (
            <span className="mc-eyebrow" style={{ color: "var(--ink-soft)" }}>
              {meta}
            </span>
          )}
        </div>
      )}
      <div style={padded ? { padding: 22 } : undefined}>{children}</div>
    </div>
  );
}

export function LoadingState({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div
      style={{
        padding: 52,
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
      <span>{label}</span>
    </div>
  );
}

/** Empty state with the three-slot block motif. */
export function EmptyState({ message, hint }: { message: string; hint?: ReactNode }) {
  return (
    <div style={{ padding: "60px 32px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", gap: 6, marginBottom: 16 }} aria-hidden>
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
      <p style={{ margin: 0, fontSize: 14, color: "var(--ink)" }}>{message}</p>
      {hint && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{hint}</p>
      )}
    </div>
  );
}
