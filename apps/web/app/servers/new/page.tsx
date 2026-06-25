"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  getLoaderVersions,
  getJavaTag,
  createServer,
  listPorts,
} from "@/lib/api";
import type {
  LoaderType,
  LoaderVersions,
  PortAllocation,
} from "@/lib/types";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const LOADERS: LoaderType[] = ["VANILLA", "FORGE", "NEOFORGE", "FABRIC"];

// ──────────────────────────────────────────────
// Shared style helpers
// ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  fontFamily: "var(--font-mono)",
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border-muted)",
  borderRadius: "4px",
  color: "var(--color-text-primary)",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none" as React.CSSProperties["appearance"],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b949e'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: "28px",
};

const readonlyStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: "var(--color-bg-elevated)",
  color: "var(--color-text-secondary)",
  cursor: "default",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "var(--color-text-secondary)",
  marginBottom: "6px",
};

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "11px",
            color: "var(--color-text-muted)",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Page wrapper (auth + layout)
// ──────────────────────────────────────────────

export default function NewServerPage() {
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
          <NewServerContent />
        </main>
      </div>
    </AuthGuard>
  );
}

// ──────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────

function NewServerContent() {
  const router = useRouter();
  const { user } = useAuth();

  const canOperate =
    user?.role === "admin" || user?.role === "operator";

  // Form fields
  const [loader, setLoader] = useState<LoaderType>("VANILLA");
  const [mcVersion, setMcVersion] = useState("");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [name, setName] = useState("");
  const [memoryMb, setMemoryMb] = useState(2048);
  const [gamePort, setGamePort] = useState(25565);
  const [rconPort, setRconPort] = useState(25575);
  const [eulaAccepted, setEulaAccepted] = useState(false);

  // Derived/async state
  const [versions, setVersions] = useState<LoaderVersions | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [javaTag, setJavaTag] = useState("");
  const [javaTagLoading, setJavaTagLoading] = useState(false);
  const [usedPorts, setUsedPorts] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [portConflicts, setPortConflicts] = useState<number[]>([]);

  // Load used ports once
  useEffect(() => {
    listPorts()
      .then((allocs: PortAllocation[]) => {
        setUsedPorts(new Set(allocs.map((a) => a.port)));
      })
      .catch(() => {
        // Non-critical; skip
      });
  }, []);

  // Load versions when loader changes
  const fetchVersions = useCallback(async (l: LoaderType) => {
    setVersionsLoading(true);
    setVersions(null);
    setMcVersion("");
    setLoaderVersion("");
    setJavaTag("");
    try {
      const v = await getLoaderVersions(l);
      setVersions(v);
      if (v.mcVersions.length > 0) {
        setMcVersion(v.mcVersions[0]);
      }
    } catch {
      toast("バージョン情報の取得に失敗しました。", "error");
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVersions(loader);
  }, [loader, fetchVersions]);

  // Set default loaderVersion when mcVersion or versions change
  useEffect(() => {
    if (!versions || loader === "VANILLA") {
      setLoaderVersion("");
      return;
    }
    if (loader === "FABRIC" && versions.loaderVersions) {
      setLoaderVersion(versions.loaderVersions[0] ?? "");
    } else if (
      (loader === "FORGE" || loader === "NEOFORGE") &&
      mcVersion &&
      versions.loaderVersionsByMc
    ) {
      const opts = versions.loaderVersionsByMc[mcVersion] ?? [];
      setLoaderVersion(opts[0] ?? "");
    }
  }, [mcVersion, versions, loader]);

  // Fetch javaTag when mcVersion + loader are both set
  useEffect(() => {
    if (!mcVersion) {
      setJavaTag("");
      return;
    }
    setJavaTagLoading(true);
    setJavaTag("");
    getJavaTag(mcVersion, loader)
      .then((tag) => setJavaTag(tag))
      .catch(() => setJavaTag("(取得失敗)"))
      .finally(() => setJavaTagLoading(false));
  }, [mcVersion, loader]);

  // Port warnings
  const gamePortConflict =
    usedPorts.has(gamePort) ||
    (gamePort === rconPort && gamePort !== 0);
  const rconPortConflict =
    usedPorts.has(rconPort) ||
    (gamePort === rconPort && rconPort !== 0);

  // Available loader versions for FORGE/NEOFORGE
  const forgeVersionOptions =
    (loader === "FORGE" || loader === "NEOFORGE") &&
    mcVersion &&
    versions?.loaderVersionsByMc
      ? (versions.loaderVersionsByMc[mcVersion] ?? [])
      : [];

  const fabricVersionOptions =
    loader === "FABRIC" && versions?.loaderVersions
      ? versions.loaderVersions
      : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eulaAccepted) return;
    setSubmitting(true);
    setSubmitError(null);
    setPortConflicts([]);

    try {
      await createServer({
        name: name.trim(),
        loaderType: loader,
        mcVersion,
        loaderVersion:
          loader === "VANILLA" || !loaderVersion ? null : loaderVersion,
        memoryMb,
        gamePort,
        rconPort,
        eulaAccepted: true,
      });
      toast(`「${name}」を作成しました。`, "success");
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Port conflict
        try {
          const body = err.message;
          // The api.ts throws with the error string; we try to get conflicts from detail
          setSubmitError(
            "指定したポートはすでに使用されています。別のポートを指定してください。"
          );
          // Try to extract conflicts from the error message if it contains numbers
          const nums = body.match(/\d+/g);
          if (nums) setPortConflicts(nums.map(Number));
        } catch {
          setSubmitError("ポートが競合しています。");
        }
      } else if (err instanceof ApiError && err.status === 400) {
        setSubmitError(`入力エラー: ${err.message}`);
      } else if (err instanceof ApiError && err.status === 502) {
        setSubmitError(
          `サーバーの作成中にエラーが発生しました: ${err.message}`
        );
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("予期しないエラーが発生しました。");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!canOperate) {
    return (
      <div
        style={{
          padding: "48px",
          textAlign: "center",
          color: "var(--color-danger)",
          fontFamily: "var(--font-mono)",
        }}
      >
        403 — この操作は operator 以上のロールが必要です。
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "680px" }}>
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
          新規サーバー作成
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          Minecraft サーバー(Docker コンテナ)を新規作成します。
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        {/* Card: ローダー設定 */}
        <div
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle>ローダー設定</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Loader type */}
            <FormField label="ローダー種別">
              <select
                value={loader}
                onChange={(e) => setLoader(e.target.value as LoaderType)}
                style={selectStyle}
              >
                {LOADERS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </FormField>

            {/* MC Version */}
            <FormField
              label="Minecraft バージョン"
              hint={
                versions?.stale
                  ? "最新バージョン情報の取得に失敗しました(前回取得値を表示)"
                  : undefined
              }
            >
              {versionsLoading ? (
                <div style={{ ...inputStyle, color: "var(--color-text-muted)" }}>
                  取得中…
                </div>
              ) : versions && versions.mcVersions.length > 0 ? (
                <select
                  value={mcVersion}
                  onChange={(e) => setMcVersion(e.target.value)}
                  style={{
                    ...selectStyle,
                    borderColor: versions.stale
                      ? "var(--color-warning)"
                      : "var(--color-border-muted)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-accent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = versions?.stale
                      ? "var(--color-warning)"
                      : "var(--color-border-muted)";
                  }}
                >
                  {versions.mcVersions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ ...inputStyle, color: "var(--color-text-muted)" }}>
                  バージョン情報なし
                </div>
              )}
            </FormField>

            {/* Loader version (FABRIC, FORGE, NEOFORGE) */}
            {loader !== "VANILLA" && (
              <FormField label="ローダーバージョン">
                {loader === "FABRIC" ? (
                  fabricVersionOptions.length > 0 ? (
                    <select
                      value={loaderVersion}
                      onChange={(e) => setLoaderVersion(e.target.value)}
                      style={selectStyle}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--color-accent)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--color-border-muted)";
                      }}
                    >
                      {fabricVersionOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      style={{ ...inputStyle, color: "var(--color-text-muted)" }}
                    >
                      ローダーバージョン情報なし
                    </div>
                  )
                ) : forgeVersionOptions.length > 0 ? (
                  <select
                    value={loaderVersion}
                    onChange={(e) => setLoaderVersion(e.target.value)}
                    style={selectStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-accent)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--color-border-muted)";
                    }}
                  >
                    {forgeVersionOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    style={{ ...inputStyle, color: "var(--color-text-muted)" }}
                  >
                    {mcVersion
                      ? `MC ${mcVersion} 向けのローダーバージョン情報がありません`
                      : "まず Minecraft バージョンを選択してください"}
                  </div>
                )}
              </FormField>
            )}

            {/* Java tag (read-only) */}
            <FormField
              label="Java タグ (自動決定)"
              hint="MC バージョンとローダーに基づき自動的に決定されます。変更できません。"
            >
              <div style={readonlyStyle}>
                {javaTagLoading
                  ? "取得中…"
                  : javaTag || (mcVersion ? "—" : "MC バージョン選択後に表示")}
              </div>
            </FormField>
          </div>
        </div>

        {/* Card: 基本設定 */}
        <div
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle>基本設定</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Name */}
            <FormField label="サーバー名">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-minecraft-server"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border-muted)";
                }}
              />
            </FormField>

            {/* Memory */}
            <FormField
              label="メモリ上限 (MB)"
              hint="512 〜 65536 MB の範囲で指定してください。"
            >
              <input
                type="number"
                required
                min={512}
                max={65536}
                step={256}
                value={memoryMb}
                onChange={(e) =>
                  setMemoryMb(Math.max(512, parseInt(e.target.value) || 512))
                }
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border-muted)";
                }}
              />
            </FormField>
          </div>
        </div>

        {/* Card: ポート設定 */}
        <div
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <SectionTitle>ポート設定</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {/* Game port */}
            <FormField label="ゲームポート">
              <input
                type="number"
                required
                min={1024}
                max={65535}
                value={gamePort}
                onChange={(e) =>
                  setGamePort(parseInt(e.target.value) || 25565)
                }
                style={{
                  ...inputStyle,
                  borderColor: gamePortConflict
                    ? "var(--color-warning)"
                    : "var(--color-border-muted)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = gamePortConflict
                    ? "var(--color-warning)"
                    : "var(--color-border-muted)";
                }}
              />
              {gamePortConflict && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "11px",
                    color: "var(--color-warning)",
                  }}
                >
                  {usedPorts.has(gamePort)
                    ? `ポート ${gamePort} はすでに使用中です。`
                    : "ゲームポートと RCON ポートが同じです。"}
                </p>
              )}
            </FormField>

            {/* RCON port */}
            <FormField label="RCON ポート">
              <input
                type="number"
                required
                min={1024}
                max={65535}
                value={rconPort}
                onChange={(e) =>
                  setRconPort(parseInt(e.target.value) || 25575)
                }
                style={{
                  ...inputStyle,
                  borderColor: rconPortConflict
                    ? "var(--color-warning)"
                    : "var(--color-border-muted)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = rconPortConflict
                    ? "var(--color-warning)"
                    : "var(--color-border-muted)";
                }}
              />
              {rconPortConflict && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "11px",
                    color: "var(--color-warning)",
                  }}
                >
                  {usedPorts.has(rconPort)
                    ? `ポート ${rconPort} はすでに使用中です。`
                    : "ゲームポートと RCON ポートが同じです。"}
                </p>
              )}
            </FormField>
          </div>
        </div>

        {/* Card: EULA */}
        <div
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <SectionTitle>Minecraft EULA</SectionTitle>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={eulaAccepted}
              onChange={(e) => setEulaAccepted(e.target.checked)}
              style={{
                marginTop: "2px",
                width: "16px",
                height: "16px",
                flexShrink: 0,
                accentColor: "var(--color-accent)",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary)",
                lineHeight: "1.6",
              }}
            >
              <a
                href="https://aka.ms/MinecraftEULA"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--color-accent)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                Minecraft End User License Agreement (EULA)
              </a>{" "}
              を読み、同意します。EULA への同意はサーバー起動に必要です。
            </span>
          </label>
        </div>

        {/* Error */}
        {submitError && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              backgroundColor: "#3a1a1a",
              border: "1px solid var(--color-danger)",
              borderRadius: "6px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-danger)",
            }}
          >
            {submitError}
            {portConflicts.length > 0 && (
              <span> (競合ポート: {portConflicts.join(", ")})</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="submit"
            disabled={submitting || !eulaAccepted || !mcVersion || !name.trim()}
            style={{
              padding: "10px 28px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              backgroundColor:
                submitting || !eulaAccepted || !mcVersion || !name.trim()
                  ? "var(--color-accent-dim)"
                  : "var(--color-accent)",
              color:
                submitting || !eulaAccepted || !mcVersion || !name.trim()
                  ? "var(--color-accent)"
                  : "#0d1117",
              border: "none",
              borderRadius: "4px",
              cursor:
                submitting || !eulaAccepted || !mcVersion || !name.trim()
                  ? "not-allowed"
                  : "pointer",
              transition: "opacity 0.15s",
            }}
          >
            {submitting ? "作成中…(イメージ取得のため時間がかかります)" : "サーバーを作成"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => router.push("/")}
            style={{
              padding: "10px 20px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "4px",
              color: "var(--color-text-secondary)",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.borderColor = "var(--color-text-secondary)";
                e.currentTarget.style.color = "var(--color-text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 16px",
        fontSize: "13px",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </h2>
  );
}
