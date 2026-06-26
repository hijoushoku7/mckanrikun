"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, LoadingState } from "@/components/mc";
import { toast } from "@/components/Toast";
import { ApiError, getFtpInfo } from "@/lib/api";
import type { FtpInfo } from "@/lib/types";

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-pixel)",
  fontSize: 9,
  letterSpacing: "0.07em",
  color: "var(--ink-soft)",
  marginBottom: 7,
};

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <div className="mc-value">{value}</div>
    </div>
  );
}

export default function FtpPage() {
  return (
    <AppShell>
      <FtpContent />
    </AppShell>
  );
}

function FtpContent() {
  const [ftp, setFtp] = useState<FtpInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchFtp = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    getFtpInfo()
      .then((data) => setFtp(data))
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? `FTP 情報の取得に失敗しました: ${err.message}`
            : "FTP 情報の取得に失敗しました。";
        setFetchError(msg);
        toast(msg, "error");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFtp();
  }, [fetchFtp]);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <PageHeader
        eyebrow="MODS / FTP"
        title="FTP 接続情報"
        subtitle="MOD ファイルのアップロードに使用する FTP サーバーの接続情報"
      />

      <div className="mc-note" style={{ marginBottom: 24 }}>
        このページは接続情報の閲覧のみです。FTP 経由のファイルアップロード機能は管理画面のスコープ外です。
      </div>

      {loading ? (
        <Panel>
          <LoadingState />
        </Panel>
      ) : fetchError ? (
        <Panel padded>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              fontFamily: "var(--font-data)",
              fontSize: 13,
              color: "var(--redstone)",
            }}
          >
            <span>{fetchError}</span>
            <div>
              <button type="button" className="mc-btn mc-btn--redstone" onClick={fetchFtp}>
                再試行
              </button>
            </div>
          </div>
        </Panel>
      ) : ftp ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Panel title="接続情報" padded>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 18,
              }}
            >
              <div>
                <span style={fieldLabel}>ホスト</span>
                {ftp.host ? (
                  <div className="mc-value">{ftp.host}</div>
                ) : (
                  <div className="mc-value" style={{ color: "var(--ink-mute)", fontStyle: "italic" }}>
                    未設定
                  </div>
                )}
                {!ftp.host && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 11,
                      color: "var(--ink-mute)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    ※ 未設定の場合はサーバーのホスト IP を使用してください
                  </p>
                )}
              </div>
              <InfoField label="ポート" value={String(ftp.port)} />
              <InfoField label="ユーザー名" value={ftp.user} />
            </div>
          </Panel>

          <Panel title="MOD 配置パステンプレート" padded>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 12.5,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                fontFamily: "var(--font-data)",
              }}
            >
              各サーバーの mods は、テンプレートの{" "}
              <code
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  padding: "1px 6px",
                  backgroundColor: "var(--slot-deep)",
                  border: "1px solid var(--outline)",
                  color: "#9fe07a",
                }}
              >
                :id
              </code>{" "}
              をサーバー ID に置換したパスに配置してください。
            </p>
            <InfoField label="テンプレート" value={ftp.modsPathTemplate} />
          </Panel>
        </div>
      ) : (
        <Panel>
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--ink-mute)",
              fontSize: 13,
              fontFamily: "var(--font-data)",
            }}
          >
            FTP 情報を取得できませんでした。
          </div>
        </Panel>
      )}
    </div>
  );
}
