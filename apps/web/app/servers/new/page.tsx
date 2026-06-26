"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel } from "@/components/mc";
import { loaderColor, loaderLabel } from "@/components/PingBars";
import { toast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getLoaderVersions, getJavaTag, createServer, listPorts } from "@/lib/api";
import type { LoaderType, LoaderVersions, PortAllocation } from "@/lib/types";

const LOADERS: LoaderType[] = ["VANILLA", "FORGE", "NEOFORGE", "FABRIC"];

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-pixel)",
  fontSize: 9,
  letterSpacing: "0.07em",
  color: "var(--ink-soft)",
  marginBottom: 7,
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
      <label style={fieldLabel}>{label}</label>
      {children}
      {hint && (
        <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-data)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function NewServerPage() {
  return (
    <AppShell>
      <NewServerContent />
    </AppShell>
  );
}

function NewServerContent() {
  const router = useRouter();
  const { user } = useAuth();

  const canOperate = user?.role === "admin" || user?.role === "operator";

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
  const gamePortConflict = usedPorts.has(gamePort) || (gamePort === rconPort && gamePort !== 0);
  const rconPortConflict = usedPorts.has(rconPort) || (gamePort === rconPort && rconPort !== 0);

  // Available loader versions for FORGE/NEOFORGE
  const forgeVersionOptions =
    (loader === "FORGE" || loader === "NEOFORGE") && mcVersion && versions?.loaderVersionsByMc
      ? versions.loaderVersionsByMc[mcVersion] ?? []
      : [];

  const fabricVersionOptions =
    loader === "FABRIC" && versions?.loaderVersions ? versions.loaderVersions : [];

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
        loaderVersion: loader === "VANILLA" || !loaderVersion ? null : loaderVersion,
        memoryMb,
        gamePort,
        rconPort,
        eulaAccepted: true,
      });
      toast(`「${name}」を作成しました。`, "success");
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const body = err.message;
          setSubmitError("指定したポートはすでに使用されています。別のポートを指定してください。");
          const nums = body.match(/\d+/g);
          if (nums) setPortConflicts(nums.map(Number));
        } catch {
          setSubmitError("ポートが競合しています。");
        }
      } else if (err instanceof ApiError && err.status === 400) {
        setSubmitError(`入力エラー: ${err.message}`);
      } else if (err instanceof ApiError && err.status === 502) {
        setSubmitError(`サーバーの作成中にエラーが発生しました: ${err.message}`);
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
          padding: 48,
          textAlign: "center",
          color: "var(--redstone)",
          fontFamily: "var(--font-data)",
        }}
      >
        403 — この操作は operator 以上のロールが必要です。
      </div>
    );
  }

  const placeholder = (text: string) => (
    <div className="mc-value" style={{ color: "var(--ink-mute)" }}>
      {text}
    </div>
  );

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <PageHeader
        eyebrow="NEW WORLD"
        title="新規サーバー作成"
        subtitle="Minecraft サーバー(Docker コンテナ)を新規作成します。"
      />

      <form onSubmit={(e) => void handleSubmit(e)}>
        {/* ローダー設定 */}
        <Panel title="ローダー設定" padded style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Loader picker — choose a block */}
            <FormField label="ローダー種別">
              <div
                role="radiogroup"
                aria-label="ローダー種別"
                style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}
              >
                {LOADERS.map((l) => {
                  const active = loader === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className="mc-btn"
                      onClick={() => setLoader(l)}
                      style={{
                        flexDirection: "column",
                        gap: 8,
                        padding: "14px 6px",
                        color: active ? "var(--ink)" : "var(--ink-soft)",
                        boxShadow: active
                          ? "inset 2px 2px 0 0 rgba(255,255,255,0.5), inset -2px -2px 0 0 rgba(0,0,0,0.22), 0 0 0 3px var(--grass)"
                          : undefined,
                      }}
                    >
                      <span
                        className="block-icon"
                        style={{ width: 30, height: 30, backgroundColor: loaderColor(l) }}
                        aria-hidden
                      />
                      {loaderLabel(l)}
                    </button>
                  );
                })}
              </div>
            </FormField>

            {/* MC Version */}
            <FormField
              label="MINECRAFT バージョン"
              hint={
                versions?.stale
                  ? "最新バージョン情報の取得に失敗しました(前回取得値を表示)"
                  : undefined
              }
            >
              {versionsLoading ? (
                placeholder("取得中…")
              ) : versions && versions.mcVersions.length > 0 ? (
                <select
                  className="mc-select"
                  value={mcVersion}
                  onChange={(e) => setMcVersion(e.target.value)}
                  style={{ width: "100%", borderColor: versions.stale ? "var(--gold)" : undefined }}
                >
                  {versions.mcVersions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                placeholder("バージョン情報なし")
              )}
            </FormField>

            {/* Loader version (FABRIC, FORGE, NEOFORGE) */}
            {loader !== "VANILLA" && (
              <FormField label="ローダーバージョン">
                {loader === "FABRIC" ? (
                  fabricVersionOptions.length > 0 ? (
                    <select
                      className="mc-select"
                      value={loaderVersion}
                      onChange={(e) => setLoaderVersion(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      {fabricVersionOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    placeholder("ローダーバージョン情報なし")
                  )
                ) : forgeVersionOptions.length > 0 ? (
                  <select
                    className="mc-select"
                    value={loaderVersion}
                    onChange={(e) => setLoaderVersion(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {forgeVersionOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  placeholder(
                    mcVersion
                      ? `MC ${mcVersion} 向けのローダーバージョン情報がありません`
                      : "まず Minecraft バージョンを選択してください"
                  )
                )}
              </FormField>
            )}

            {/* Java tag (read-only) */}
            <FormField
              label="JAVA タグ (自動決定)"
              hint="MC バージョンとローダーに基づき自動的に決定されます。変更できません。"
            >
              <div className="mc-value" style={{ color: "var(--gold)" }}>
                {javaTagLoading
                  ? "取得中…"
                  : javaTag || (mcVersion ? "—" : "MC バージョン選択後に表示")}
              </div>
            </FormField>
          </div>
        </Panel>

        {/* 基本設定 */}
        <Panel title="基本設定" padded style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <FormField label="サーバー名">
              <input
                type="text"
                className="mc-input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-minecraft-server"
              />
            </FormField>

            <FormField label="メモリ上限 (MB)" hint="512 〜 65536 MB の範囲で指定してください。">
              <input
                type="number"
                className="mc-input"
                required
                min={512}
                max={65536}
                step={256}
                value={memoryMb}
                onChange={(e) => setMemoryMb(Math.max(512, parseInt(e.target.value) || 512))}
              />
            </FormField>
          </div>
        </Panel>

        {/* ポート設定 */}
        <Panel title="ポート設定" padded style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FormField label="ゲームポート">
              <input
                type="number"
                className="mc-input"
                required
                min={1024}
                max={65535}
                value={gamePort}
                onChange={(e) => setGamePort(parseInt(e.target.value) || 25565)}
                style={{ borderColor: gamePortConflict ? "var(--gold)" : undefined }}
              />
              {gamePortConflict && (
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--gold)", fontFamily: "var(--font-data)" }}>
                  {usedPorts.has(gamePort)
                    ? `ポート ${gamePort} はすでに使用中です。`
                    : "ゲームポートと RCON ポートが同じです。"}
                </p>
              )}
            </FormField>

            <FormField label="RCON ポート">
              <input
                type="number"
                className="mc-input"
                required
                min={1024}
                max={65535}
                value={rconPort}
                onChange={(e) => setRconPort(parseInt(e.target.value) || 25575)}
                style={{ borderColor: rconPortConflict ? "var(--gold)" : undefined }}
              />
              {rconPortConflict && (
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--gold)", fontFamily: "var(--font-data)" }}>
                  {usedPorts.has(rconPort)
                    ? `ポート ${rconPort} はすでに使用中です。`
                    : "ゲームポートと RCON ポートが同じです。"}
                </p>
              )}
            </FormField>
          </div>
        </Panel>

        {/* EULA */}
        <Panel title="MINECRAFT EULA" padded style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={eulaAccepted}
              onChange={(e) => setEulaAccepted(e.target.checked)}
              style={{
                marginTop: 2,
                width: 18,
                height: 18,
                flexShrink: 0,
                accentColor: "var(--grass)",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              <a
                href="https://aka.ms/MinecraftEULA"
                target="_blank"
                rel="noopener noreferrer"
                className="mc-link"
              >
                Minecraft End User License Agreement (EULA)
              </a>{" "}
              を読み、同意します。EULA への同意はサーバー起動に必要です。
            </span>
          </label>
        </Panel>

        {/* Error */}
        {submitError && (
          <div
            role="alert"
            className="mc-slot"
            style={{
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 13,
              fontFamily: "var(--font-data)",
              color: "#ffd9d3",
              backgroundColor: "var(--redstone-lo)",
            }}
          >
            {submitError}
            {portConflicts.length > 0 && <span> (競合ポート: {portConflicts.join(", ")})</span>}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="submit"
            className="mc-btn mc-btn--grass"
            disabled={submitting || !eulaAccepted || !mcVersion || !name.trim()}
            style={{ padding: "11px 26px", fontSize: 14 }}
          >
            {submitting ? "作成中…(イメージ取得のため時間がかかります)" : "サーバーを作成"}
          </button>
          <button
            type="button"
            className="mc-btn"
            disabled={submitting}
            onClick={() => router.push("/")}
            style={{ padding: "11px 20px" }}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
