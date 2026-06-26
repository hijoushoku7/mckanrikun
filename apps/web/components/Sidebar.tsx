"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listServers } from "@/lib/api";
import type { Server, ServerStatus } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
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

function statusColor(status: ServerStatus): string {
  switch (status) {
    case "running":
      return "var(--grass)";
    case "starting":
    case "stopping":
      return "var(--gold)";
    case "error":
      return "var(--redstone)";
    default:
      return "var(--ink-mute)";
  }
}

const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/" },
  { label: "ポート", href: "/ports" },
  { label: "FTP", href: "/ftp" },
  { label: "ユーザー", href: "/users", adminOnly: true },
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
      className="mc-panel"
      style={{
        width: 232,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderTop: 0,
        borderBottom: 0,
        borderLeft: 0,
        fontFamily: "var(--font-display)",
      }}
    >
      {/* Wordmark — a grass block with pixel "MC", then the Japanese name */}
      <div
        style={{
          padding: "22px 18px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "2px solid var(--bevel-lo)",
        }}
      >
        <span
          className="block-icon"
          style={{
            width: 38,
            height: 38,
            backgroundColor: "var(--grass)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 11,
              color: "#f3f7ee",
              letterSpacing: "0.02em",
            }}
          >
            MC
          </span>
        </span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>
            管理くん
          </div>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 7,
              letterSpacing: "0.06em",
              color: "var(--ink-mute)",
              marginTop: 3,
            }}
          >
            SERVER CONSOLE
          </div>
        </div>
      </div>

      {/* Navigation — each item is a slot you press */}
      <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                fontSize: 13.5,
                fontWeight: 700,
                textDecoration: "none",
                color: active ? "#f3f7ee" : "var(--ink-soft)",
                backgroundColor: active ? "var(--grass)" : "transparent",
                border: active ? "2px solid var(--outline)" : "2px solid transparent",
                boxShadow: active
                  ? "inset 2px 2px 0 0 rgba(255,255,255,0.32), inset -2px -2px 0 0 rgba(0,0,0,0.26)"
                  : "none",
                transition: "background-color 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  flexShrink: 0,
                  backgroundColor: active ? "#f3f7ee" : "var(--ink-mute)",
                  border: "1px solid var(--outline)",
                }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 最近起動したサーバー */}
      {recentServer && (
        <div
          style={{
            padding: "14px 18px",
            borderTop: "2px solid var(--bevel-lo)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              letterSpacing: "0.08em",
              color: "var(--ink-mute)",
              marginBottom: 8,
            }}
          >
            RECENT SERVER
          </div>
          <Link
            href={`/servers/${recentServer.id}/console`}
            title={`${recentServer.name} のコンソールを開く`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              border: "2px solid var(--outline)",
              backgroundColor:
                pathname === `/servers/${recentServer.id}/console`
                  ? "rgba(93, 141, 56, 0.22)"
                  : "rgba(0,0,0,0.04)",
              textDecoration: "none",
              boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                flexShrink: 0,
                backgroundColor: statusColor(recentServer.liveStatus),
                border: "1px solid var(--outline)",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--font-data)",
                color: "var(--ink)",
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

      {/* Signed-in user + sign out */}
      {user && (
        <div
          style={{
            padding: "16px 18px",
            borderTop: "2px solid var(--bevel-lo)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: 2,
            }}
          >
            {user.username}
          </div>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 8,
              letterSpacing: "0.06em",
              color: "var(--ink-mute)",
              marginBottom: 12,
            }}
          >
            {user.role.toUpperCase()}
          </div>
          <button
            type="button"
            className="mc-btn"
            onClick={() => void handleLogout()}
            style={{ width: "100%", fontSize: 12.5 }}
          >
            サインアウト
          </button>
        </div>
      )}
    </aside>
  );
}
