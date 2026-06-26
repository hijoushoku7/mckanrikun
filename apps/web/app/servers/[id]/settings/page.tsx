"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/mc";
import { PingBars } from "@/components/PingBars";
import { toast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  getServer,
  getServerProperties,
  saveServerProperties,
  getFtpInfo,
  getServerFtp,
  updateServer,
} from "@/lib/api";
import type { Server, PropertyField, FtpInfo } from "@/lib/types";

// ──────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-pixel)",
  fontSize: 9,
  letterSpacing: "0.07em",
  color: "var(--ink-soft)",
  marginBottom: 7,
};

function RestartBadge() {
  return (
    <span
      className="mc-chip"
      style={{ marginLeft: 6, borderColor: "var(--gold)", color: "var(--gold)", verticalAlign: "middle" }}
    >
      要再起動
    </span>
  );
}

function LabeledValue({
  label,
  value,
  color,
  italic,
}: {
  label: string;
  value: string;
  color?: string;
  italic?: boolean;
}) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <div className="mc-value" style={{ color, fontStyle: italic ? "italic" : undefined }}>
        {value}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// PropertyFormField — renders one field based on type
// ──────────────────────────────────────────────

interface PropertyFormFieldProps {
  field: PropertyField;
  value: string;
  readonly: boolean;
  onChange: (key: string, value: string) => void;
}

function PropertyFormField({ field, value, readonly, onChange }: PropertyFormFieldProps) {
  const { key, label, type, options, min, max, requiresRestart } = field;

  const labelEl = (
    <label style={fieldLabel}>
      {label}
      {requiresRestart && <RestartBadge />}
    </label>
  );

  if (type === "bool") {
    const checked = value === "true";
    return (
      <div>
        {labelEl}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: readonly ? "default" : "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={readonly}
            onChange={(e) => onChange(key, e.target.checked ? "true" : "false")}
            style={{
              width: 18,
              height: 18,
              flexShrink: 0,
              accentColor: "var(--grass)",
              cursor: readonly ? "default" : "pointer",
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-data)",
              color: checked ? "var(--ink)" : "var(--ink-mute)",
            }}
          >
            {checked ? "有効 (true)" : "無効 (false)"}
          </span>
        </label>
      </div>
    );
  }

  if (type === "enum" && options) {
    return (
      <div>
        {labelEl}
        {readonly ? (
          <div className="mc-value">{value || "—"}</div>
        ) : (
          <select
            className="mc-select"
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
            style={{ width: "100%" }}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  if (type === "int") {
    return (
      <div>
        {labelEl}
        {readonly ? (
          <div className="mc-value">{value || "—"}</div>
        ) : (
          <input
            type="number"
            className="mc-input"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(key, e.target.value)}
          />
        )}
        {(min !== undefined || max !== undefined) && !readonly && (
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-data)" }}>
            {min !== undefined && max !== undefined
              ? `${min} 〜 ${max}`
              : min !== undefined
                ? `最小: ${min}`
                : `最大: ${max}`}
          </p>
        )}
      </div>
    );
  }

  // string (default)
  return (
    <div>
      {labelEl}
      {readonly ? (
        <div className="mc-value">{value || "—"}</div>
      ) : (
        <input
          type="text"
          className="mc-input"
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Page wrapper
// ──────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

// ──────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────

function SettingsContent() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const canOperate = user?.role === "admin" || user?.role === "operator";

  const [server, setServer] = useState<Server | null>(null);
  const [serverLoading, setServerLoading] = useState(true);

  // Properties state
  const [fields, setFields] = useState<PropertyField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [propsLoading, setPropsLoading] = useState(true);
  const [propsError, setPropsError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);

  // Save state (properties)
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restartKeys, setRestartKeys] = useState<string[]>([]);

  // Validation errors: key -> message
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // FTP state
  const [ftpInfo, setFtpInfo] = useState<FtpInfo | null>(null);
  const [serverFtpPath, setServerFtpPath] = useState<string | null>(null);
  const [ftpLoading, setFtpLoading] = useState(true);

  // Memory edit state
  const [memoryInput, setMemoryInput] = useState<string>("");
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memorySaving, setMemorySaving] = useState(false);

  // ── Fetch server info ──
  useEffect(() => {
    if (!id) return;
    setServerLoading(true);
    getServer(id)
      .then((s) => {
        setServer(s);
        setMemoryInput(String(s.memoryMb));
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          toast(`サーバー情報の取得に失敗: ${err.message}`, "error");
        } else {
          toast("サーバー情報の取得に失敗しました。", "error");
        }
      })
      .finally(() => setServerLoading(false));
  }, [id]);

  // ── ステータスの軽量ポーリング(操作後の状態変化を反映) ──
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      getServer(id)
        .then((s) =>
          setServer((prev) =>
            prev ? { ...prev, liveStatus: s.liveStatus } : s
          )
        )
        .catch(() => {
          // ポーリング失敗は無視(次回再試行)。
        });
    }, 5000);
    return () => clearInterval(t);
  }, [id]);

  // ── Fetch FTP info ──
  useEffect(() => {
    if (!id) return;
    setFtpLoading(true);
    Promise.all([getFtpInfo(), getServerFtp(id)])
      .then(([info, serverFtp]) => {
        setFtpInfo(info);
        setServerFtpPath(serverFtp.modsPath);
      })
      .catch(() => {
        // FTP 情報取得失敗は非ブロッキング
      })
      .finally(() => setFtpLoading(false));
  }, [id]);

  // ── Fetch properties ──
  const fetchProperties = useCallback(async () => {
    if (!id) return;
    setPropsLoading(true);
    setPropsError(null);
    setNotReady(false);
    try {
      const data = await getServerProperties(id);
      setFields(data.fields);
      const initial: Record<string, string> = {};
      for (const f of data.fields) {
        initial[f.key] = data.values[f.key] ?? "";
      }
      setFormValues(initial);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNotReady(true);
      } else if (err instanceof ApiError && err.status === 404) {
        setPropsError("サーバーが見つかりません。");
      } else if (err instanceof ApiError) {
        setPropsError(`設定の取得に失敗しました: ${err.message}`);
      } else {
        setPropsError("設定の取得に失敗しました。");
      }
    } finally {
      setPropsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  // ── Field change handler ──
  function handleChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  // ── Client-side validation ──
  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const f of fields) {
      const raw = formValues[f.key] ?? "";
      if (f.type === "int") {
        if (raw === "") continue;
        const num = Number(raw);
        if (!Number.isInteger(num) || isNaN(num)) {
          errors[f.key] = "整数を入力してください。";
        } else if (f.min !== undefined && num < f.min) {
          errors[f.key] = `${f.min} 以上の値を入力してください。`;
        } else if (f.max !== undefined && num > f.max) {
          errors[f.key] = `${f.max} 以下の値を入力してください。`;
        }
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Save handler ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canOperate || saving) return;
    if (!validate()) {
      toast("入力値に誤りがあります。", "error");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setRestartKeys([]);

    const updates: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      const raw = formValues[f.key] ?? "";
      if (f.type === "bool") {
        updates[f.key] = raw === "true";
      } else if (f.type === "int") {
        if (raw !== "") {
          updates[f.key] = parseInt(raw, 10);
        }
      } else {
        updates[f.key] = raw;
      }
    }

    try {
      const result = await saveServerProperties(id, updates);
      setRestartKeys(result.requiresRestart);
      if (result.requiresRestart.length > 0) {
        const labels = result.requiresRestart
          .map((k) => fields.find((f) => f.key === k)?.label ?? k)
          .join(", ");
        toast(`保存しました。再起動が必要な項目: ${labels}`, "info");
      } else {
        toast("設定を保存しました。", "success");
      }
      await fetchProperties();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setSaveError(`バリデーションエラー: ${err.message}`);
      } else if (err instanceof ApiError && err.status === 409) {
        setSaveError("server.properties がまだ生成されていません。サーバーを一度起動してください。");
      } else if (err instanceof ApiError) {
        setSaveError(`保存に失敗しました: ${err.message}`);
      } else {
        setSaveError("保存に失敗しました。");
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Memory save handler ──
  async function handleMemorySave(e: React.FormEvent) {
    e.preventDefault();
    setMemoryError(null);
    const val = parseInt(memoryInput, 10);
    if (isNaN(val) || !Number.isInteger(val) || val < 512 || val > 65536) {
      setMemoryError("512〜65536 の整数を入力してください。");
      return;
    }
    setMemorySaving(true);
    try {
      const updated = await updateServer(id, { memoryMb: val });
      setServer(updated);
      setMemoryInput(String(updated.memoryMb));
      toast(`メモリを ${updated.memoryMb.toLocaleString()} MB に変更しました。`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setMemoryError(`入力値エラー: ${err.message}`);
      } else if (err instanceof ApiError && err.status === 404) {
        setMemoryError("サーバーが見つかりません。");
      } else if (err instanceof ApiError && err.status === 502) {
        setMemoryError(`Docker エラー: ${err.message}`);
      } else if (err instanceof ApiError) {
        setMemoryError(`保存に失敗しました: ${err.message}`);
      } else {
        setMemoryError("保存に失敗しました。");
      }
    } finally {
      setMemorySaving(false);
    }
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              fontSize: 12,
              fontFamily: "var(--font-data)",
              color: "var(--ink-mute)",
            }}
          >
            <Link href="/" className="mc-link" style={{ fontWeight: 400 }}>
              ダッシュボード
            </Link>
            <span>/</span>
            {server ? (
              <>
                <Link href={`/servers/${id}/console`} className="mc-link" style={{ fontWeight: 400 }}>
                  {server.name}
                </Link>
                <span>/</span>
              </>
            ) : null}
            <span>設定</span>
          </div>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: "var(--ink)",
              letterSpacing: "-0.015em",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {serverLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-mute)" }}>
                <Spinner size={16} />
                読み込み中…
              </span>
            ) : server ? (
              <>
                <span>{server.name}</span>
                <PingBars status={server.liveStatus} />
              </>
            ) : (
              <span style={{ color: "var(--redstone)" }}>サーバーが見つかりません</span>
            )}
          </h1>

          {server && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", fontFamily: "var(--font-data)" }}>
              {server.loaderType} {server.mcVersion}
              {server.loaderVersion ? ` / ${server.loaderVersion}` : ""}
              {"  ·  "}Game :{server.gamePort} · RCON :{server.rconPort}
            </p>
          )}
        </div>

        {server && (
          <Link href={`/servers/${id}/console`} className="mc-btn">
            コンソール →
          </Link>
        )}
      </div>

      {/* Body */}
      {propsLoading ? (
        <Panel>
          <div style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--ink-soft)", fontFamily: "var(--font-data)", fontSize: 13 }}>
            <Spinner size={24} />
            設定を読み込み中…
          </div>
        </Panel>
      ) : notReady ? (
        <Panel>
          <div style={{ padding: "44px 32px", textAlign: "center" }}>
            <div style={{ display: "inline-flex", gap: 6, marginBottom: 16 }} aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 16, height: 16, backgroundColor: "var(--slot)", border: "2px solid var(--outline)" }} />
              ))}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--ink)", fontWeight: 700 }}>
              server.properties がまだ生成されていません
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
              サーバーを一度起動すると server.properties が生成され、
              <br />
              設定を編集できるようになります。
            </p>
            <div style={{ marginTop: 20 }}>
              <Link href="/" className="mc-btn">
                ダッシュボードに戻る
              </Link>
            </div>
          </div>
        </Panel>
      ) : propsError ? (
        <Panel padded>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "var(--font-data)", fontSize: 13, color: "var(--redstone)" }}>
            <span>{propsError}</span>
            <div>
              <button type="button" className="mc-btn mc-btn--redstone" onClick={() => void fetchProperties()}>
                再試行
              </button>
            </div>
          </div>
        </Panel>
      ) : (
        /* Main form */
        <form onSubmit={(e) => void handleSave(e)}>
          {!canOperate && (
            <div className="mc-note" style={{ marginBottom: 20, boxShadow: "-4px 0 0 0 var(--ink-mute)" }}>
              閲覧専用モード — 設定の変更には operator 以上のロールが必要です。
            </div>
          )}

          {restartKeys.length > 0 && (
            <div className="mc-note" style={{ marginBottom: 20, color: "var(--ink)" }}>
              以下の項目は再起動後に反映されます:{" "}
              {restartKeys.map((k) => fields.find((f) => f.key === k)?.label ?? k).join(", ")}
            </div>
          )}

          {saveError && (
            <div
              role="alert"
              className="mc-slot"
              style={{ padding: "12px 16px", marginBottom: 20, fontSize: 13, fontFamily: "var(--font-data)", color: "#ffd9d3", backgroundColor: "var(--redstone-lo)" }}
            >
              {saveError}
            </div>
          )}

          <Panel title="server.properties" padded style={{ marginBottom: 24 }}>
            {fields.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-mute)", fontFamily: "var(--font-data)" }}>
                設定項目がありません。
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {fields.map((field) => (
                  <div key={field.key}>
                    <PropertyFormField
                      field={field}
                      value={formValues[field.key] ?? ""}
                      readonly={!canOperate}
                      onChange={handleChange}
                    />
                    {validationErrors[field.key] && (
                      <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--redstone)", fontFamily: "var(--font-data)" }}>
                        {validationErrors[field.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {canOperate && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button type="submit" className="mc-btn mc-btn--grass" disabled={saving} style={{ padding: "11px 26px", fontSize: 14 }}>
                {saving ? "保存中…" : "設定を保存"}
              </button>
              <Link href="/" className="mc-btn" style={{ padding: "11px 20px" }}>
                ダッシュボードに戻る
              </Link>
            </div>
          )}
        </form>
      )}

      {/* ── リソース (メモリ) ── */}
      <Panel title="リソース" padded style={{ marginTop: 32 }}>
        <div className="mc-note" style={{ marginBottom: 20, color: "var(--ink)" }}>
          メモリ変更はコンテナの再作成を伴い、一時的に停止します。
        </div>

        <form onSubmit={(e) => void handleMemorySave(e)}>
          <div style={{ marginBottom: 16, maxWidth: 280 }}>
            <label htmlFor="memoryInput" style={fieldLabel}>
              メモリ (MB)
            </label>
            <input
              id="memoryInput"
              type="number"
              className="mc-input"
              min={512}
              max={65536}
              step={1}
              value={memoryInput}
              disabled={!canOperate || memorySaving}
              onChange={(e) => {
                setMemoryInput(e.target.value);
                setMemoryError(null);
              }}
              style={{ borderColor: memoryError ? "var(--redstone)" : undefined, opacity: canOperate ? 1 : 0.6 }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-data)" }}>
              512 〜 65536
            </p>
            {memoryError && (
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--redstone)", fontFamily: "var(--font-data)" }}>
                {memoryError}
              </p>
            )}
          </div>

          {canOperate ? (
            <button type="submit" className="mc-btn mc-btn--grass" disabled={memorySaving}>
              {memorySaving ? "適用中…(コンテナを再作成します)" : "保存"}
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: 12, fontFamily: "var(--font-data)", color: "var(--ink-mute)" }}>
              閲覧専用モード — メモリの変更には operator 以上のロールが必要です。
            </p>
          )}
        </form>
      </Panel>

      {/* ── MOD 配置 (FTP) ── */}
      <Panel title="MOD 配置 (FTP)" padded style={{ marginTop: 24 }}>
        {ftpLoading ? (
          <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 8 }}>
            <Spinner size={14} />
            読み込み中…
          </div>
        ) : !ftpInfo ? (
          <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--ink-mute)" }}>
            FTP 情報を取得できませんでした。
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            <LabeledValue
              label="ホスト"
              value={ftpInfo.host || "未設定（サーバーのホスト IP を使用）"}
              color={ftpInfo.host ? undefined : "var(--ink-mute)"}
              italic={!ftpInfo.host}
            />
            <LabeledValue label="ポート" value={String(ftpInfo.port)} />
            <LabeledValue label="ユーザー名" value={ftpInfo.user} />
            {serverFtpPath && (
              <div style={{ gridColumn: "1 / -1" }}>
                <LabeledValue label="このサーバーの MOD 配置パス" value={serverFtpPath} color="#9fe07a" />
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
