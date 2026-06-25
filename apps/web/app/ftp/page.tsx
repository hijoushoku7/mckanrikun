"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { ApiError, getFtpInfo } from "@/lib/api";
import type { FtpInfo } from "@/lib/types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const monoValueStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  padding: "8px 12px",
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border-muted)",
  borderRadius: "4px",
  color: "var(--color-text-primary)",
  userSelect: "text",
  wordBreak: "break-all",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-text-secondary)",
  marginBottom: "6px",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={monoValueStyle}>{value}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function FtpPage() {
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
          <FtpContent />
        </main>
      </div>
    </AuthGuard>
  );
}

function FtpContent() {
  const [ftp, setFtp] = useState<FtpInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFtpInfo()
      .then((data) => setFtp(data))
      .catch((err) => {
        if (err instanceof ApiError) {
          toast(`FTP 情報の取得に失敗しました: ${err.message}`, "error");
        } else {
          toast("FTP 情報の取得に失敗しました。", "error");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: "640px" }}>
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
          FTP 接続情報
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          MOD ファイルのアップロードに使用する FTP サーバーの接続情報
        </p>
      </div>

      {/* Note: read-only */}
      <div
        style={{
          padding: "10px 16px",
          marginBottom: "24px",
          backgroundColor: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-muted)",
          borderRadius: "6px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-muted)",
        }}
      >
        このページは接続情報の閲覧のみです。FTP 経由のファイルアップロード機能は管理画面のスコープ外です。
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
      ) : ftp ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Connection info card */}
          <div
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "24px",
            }}
          >
            <h2
              style={{
                margin: "0 0 20px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              接続情報
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <span style={labelStyle}>ホスト</span>
                {ftp.host ? (
                  <div style={monoValueStyle}>{ftp.host}</div>
                ) : (
                  <div
                    style={{
                      ...monoValueStyle,
                      color: "var(--color-text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    未設定
                  </div>
                )}
                {!ftp.host && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ※ 未設定の場合はサーバーのホスト IP を使用してください
                  </p>
                )}
              </div>
              <InfoRow label="ポート" value={String(ftp.port)} />
              <InfoRow label="ユーザー名" value={ftp.user} />
            </div>
          </div>

          {/* MODs path template card */}
          <div
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "24px",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              MOD 配置パステンプレート
            </h2>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                lineHeight: "1.6",
              }}
            >
              各サーバーの mods は、テンプレートの{" "}
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "1px 5px",
                  backgroundColor: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "3px",
                  color: "var(--color-accent)",
                }}
              >
                :id
              </code>{" "}
              をサーバー ID に置換したパスに配置してください。
            </p>
            <InfoRow label="テンプレート" value={ftp.modsPathTemplate} />
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
          }}
        >
          FTP 情報を取得できませんでした。
        </div>
      )}
    </div>
  );
}
