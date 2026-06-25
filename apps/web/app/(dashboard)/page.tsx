"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "20px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          Signed in as{" "}
          <span
            style={{
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {user?.username}
          </span>{" "}
          <span
            style={{
              display: "inline-block",
              padding: "1px 6px",
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              backgroundColor: "var(--color-accent-dim)",
              color: "var(--color-accent)",
              borderRadius: "3px",
              border: "1px solid var(--color-accent-dim)",
            }}
          >
            {user?.role}
          </span>
        </p>
      </div>

      {/* Placeholder: Server list */}
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "48px 32px",
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
          Minecraft server list
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}
        >
          Phase 3 で実装予定
        </p>
      </div>
    </div>
  );
}
