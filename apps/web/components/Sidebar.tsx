"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listServers } from "@/lib/api";
import { statusColor } from "@/components/StatusBadge";
import type { Server } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

/** lastStartedAt が最新のサーバーを返す(未起動のみなら null)。 */
function pickRecentServer(servers: Server[]): Server | null {
  let recent: Server | null = null;
  for (const s of servers) {
    if (!s.lastStartedAt) continue;
    if (!recent || s.lastStartedAt > recent.lastStartedAt!) recent = s;
  }
  return recent;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "▪" },
  { label: "ポート", href: "/ports", icon: "▪" },
  { label: "FTP", href: "/ftp", icon: "▪" },
  { label: "Users", href: "/users", icon: "▪", adminOnly: true },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 最後に起動したサーバー(サイドバーから即コンソールへ飛べるように)。
  const [recentServer, setRecentServer] = useState<Server | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      listServers()
        .then((servers) => {
          if (!cancelled) setRecentServer(pickRecentServer(servers));
        })
        .catch(() => {
          // 取得失敗は無視(ナビの主要機能ではない)。
        });
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  return (
    <aside
      style={{
        width: "220px",
        minHeight: "100dvh",
        backgroundColor: "var(--color-bg-card)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          MC管理くん
        </div>
        <div className="pixel-border" style={{ marginTop: "10px" }} />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 20px",
                fontSize: "13px",
                textDecoration: "none",
                color: active
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
                backgroundColor: active
                  ? "var(--color-accent-dim)"
                  : "transparent",
                borderLeft: active
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              <span
                style={{
                  color: active
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)",
                  fontSize: "8px",
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 最近起動したサーバー */}
      {recentServer && (
        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-muted)",
              marginBottom: "8px",
            }}
          >
            最近起動
          </div>
          <Link
            href={`/servers/${recentServer.id}/console`}
            title={`${recentServer.name} のコンソールを開く`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "4px",
              border: "1px solid var(--color-border-muted)",
              backgroundColor:
                pathname === `/servers/${recentServer.id}/console`
                  ? "var(--color-accent-dim)"
                  : "transparent",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                flexShrink: 0,
                backgroundColor: statusColor(recentServer.liveStatus),
              }}
            />
            <span
              style={{
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {recentServer.name}
            </span>
          </Link>
        </div>
      )}

      {/* User info + logout */}
      {user && (
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              marginBottom: "4px",
              fontFamily: "var(--font-mono)",
            }}
          >
            {user.username}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {user.role}
          </div>
          <button
            onClick={() => void handleLogout()}
            style={{
              width: "100%",
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "4px",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--color-danger)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-danger)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--color-border-muted)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-text-secondary)";
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
