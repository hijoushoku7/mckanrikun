"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
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
// Style constants
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
  boxSizing: "border-box",
};

const readonlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: "var(--color-bg-elevated)",
  color: "var(--color-text-secondary)",
  cursor: "default",
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

// ──────────────────────────────────────────────
// RestartBadge
// ──────────────────────────────────────────────

function RestartBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: "6px",
        padding: "1px 6px",
        fontSize: "10px",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        borderRadius: "3px",
        backgroundColor: "#3a2e10",
        color: "var(--color-warning)",
        border: "1px solid var(--color-warning)",
        letterSpacing: "0.04em",
        verticalAlign: "middle",
      }}
    >
      要再起動
    </span>
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

function PropertyFormField({
  field,
  value,
  readonly,
  onChange,
}: PropertyFormFieldProps) {
  const { key, label, type, options, min, max, requiresRestart } = field;

  const fieldLabel = (
    <label style={labelStyle}>
      {label}
      {requiresRestart && <RestartBadge />}
    </label>
  );

  if (type === "bool") {
    const checked = value === "true";
    return (
      <div>
        {fieldLabel}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
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
              width: "16px",
              height: "16px",
              flexShrink: 0,
              accentColor: "var(--color-accent)",
              cursor: readonly ? "default" : "pointer",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              color: checked
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
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
        {fieldLabel}
        {readonly ? (
          <div style={readonlyInputStyle}>{value || "—"}</div>
        ) : (
          <select
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
            style={selectStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
            }}
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
        {fieldLabel}
        <input
          type="number"
          value={value}
          disabled={readonly}
          min={min}
          max={max}
          onChange={(e) => onChange(key, e.target.value)}
          style={readonly ? readonlyInputStyle : inputStyle}
          onFocus={(e) => {
            if (!readonly)
              e.currentTarget.style.borderColor = "var(--color-accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-muted)";
          }}
        />
        {(min !== undefined || max !== undefined) && !readonly && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "11px",
              color: "var(--color-text-muted)",
            }}
          >
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
      {fieldLabel}
      <input
        type="text"
        value={value}
        disabled={readonly}
        onChange={(e) => onChange(key, e.target.value)}
        style={readonly ? readonlyInputStyle : inputStyle}
        onFocus={(e) => {
          if (!readonly)
            e.currentTarget.style.borderColor = "var(--color-accent)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border-muted)";
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Page wrapper
// ──────────────────────────────────────────────

export default function SettingsPage() {
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
          <SettingsContent />
        </main>
      </div>
    </AuthGuard>
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
  // 409: server.properties 未生成
  const [notReady, setNotReady] = useState(false);

  // Save state (properties)
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restartKeys, setRestartKeys] = useState<string[]>([]);

  // Validation errors: key -> message
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

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
      // Initialize form values from API response; fill missing keys with ""
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
    // Clear validation error for this key when user edits
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
        if (raw === "") continue; // Allow empty (server decides default)
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

    // Build updates: convert types appropriately
    const updates: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      const raw = formValues[f.key] ?? "";
      if (f.type === "bool") {
        updates[f.key] = raw === "true";
      } else if (f.type === "int") {
        if (raw !== "") {
          updates[f.key] = parseInt(raw, 10);
        }
        // Skip empty int fields
      } else {
        updates[f.key] = raw;
      }
    }

    try {
      const result = await saveServerProperties(id, updates);
      setRestartKeys(result.requiresRestart);
      if (result.requiresRestart.length > 0) {
        // Show restart notice inline and via toast
        const labels = result.requiresRestart
          .map((k) => fields.find((f) => f.key === k)?.label ?? k)
          .join(", ");
        toast(`保存しました。再起動が必要な項目: ${labels}`, "info");
      } else {
        toast("設定を保存しました。", "success");
      }
      // Refresh from server to reflect normalized values
      await fetchProperties();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setSaveError(`バリデーションエラー: ${err.message}`);
      } else if (err instanceof ApiError && err.status === 409) {
        setSaveError(
          "server.properties がまだ生成されていません。サーバーを一度起動してください。"
        );
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
    <div style={{ maxWidth: "720px" }}>
      {/* Page header */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            <Link
              href="/"
              style={{
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              Dashboard
            </Link>
            <span>/</span>
            {server ? (
              <>
                <Link
                  href={`/servers/${id}/console`}
                  style={{
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color =
                      "var(--color-text-secondary)";
                  }}
                >
                  {server.name}
                </Link>
                <span>/</span>
              </>
            ) : null}
            <span>Settings</span>
          </div>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {serverLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--color-text-muted)" }}>
                <Spinner size={16} />
                読み込み中…
              </span>
            ) : server ? (
              <>
                <span>{server.name}</span>
                <StatusBadge status={server.liveStatus} />
              </>
            ) : (
              <span style={{ color: "var(--color-danger)" }}>
                サーバーが見つかりません
              </span>
            )}
          </h1>

          {server && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {server.loaderType} {server.mcVersion}
              {server.loaderVersion ? ` / ${server.loaderVersion}` : ""}
              {"  ·  "}Game :{server.gamePort} · RCON :{server.rconPort}
            </p>
          )}
        </div>

        {/* Navigation to console */}
        {server && (
          <Link
            href={`/servers/${id}/console`}
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "4px",
              color: "var(--color-text-secondary)",
              textDecoration: "none",
              display: "inline-block",
              transition: "border-color 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.color = "var(--color-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            コンソール →
          </Link>
        )}
      </div>

      {/* Body */}
      {propsLoading ? (
        <div
          style={{
            padding: "48px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            color: "var(--color-text-secondary)",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Spinner size={24} />
          設定を読み込み中…
        </div>
      ) : notReady ? (
        /* 409: server.properties 未生成 */
        <div
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "28px",
              color: "var(--color-border-muted)",
              marginBottom: "16px",
              userSelect: "none",
            }}
          >
            ▪ ▪ ▪
          </div>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              fontWeight: 600,
            }}
          >
            server.properties がまだ生成されていません
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              lineHeight: "1.7",
            }}
          >
            サーバーを一度起動すると server.properties が生成され、
            <br />
            設定を編集できるようになります。
          </p>
          {server && (
            <div style={{ marginTop: "20px" }}>
              <Link
                href="/"
                style={{
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                  e.currentTarget.style.color = "var(--color-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-muted)";
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                }}
              >
                ダッシュボードに戻る
              </Link>
            </div>
          )}
        </div>
      ) : propsError ? (
        <div
          style={{
            padding: "24px",
            backgroundColor: "#3a1a1a",
            border: "1px solid var(--color-danger)",
            borderRadius: "6px",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            color: "var(--color-danger)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <span>{propsError}</span>
          <div>
            <button
              onClick={() => void fetchProperties()}
              style={{
                padding: "6px 16px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "transparent",
                border: "1px solid var(--color-danger)",
                borderRadius: "4px",
                color: "var(--color-danger)",
                cursor: "pointer",
              }}
            >
              再試行
            </button>
          </div>
        </div>
      ) : (
        /* Main form */
        <form onSubmit={(e) => void handleSave(e)}>
          {/* viewer notice */}
          {!canOperate && (
            <div
              style={{
                padding: "10px 16px",
                marginBottom: "20px",
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-muted)",
                borderRadius: "6px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-muted)",
              }}
            >
              閲覧専用モード — 設定の変更には operator 以上のロールが必要です。
            </div>
          )}

          {/* Restart notice (after save) */}
          {restartKeys.length > 0 && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "20px",
                backgroundColor: "#3a2e10",
                border: "1px solid var(--color-warning)",
                borderRadius: "6px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-warning)",
              }}
            >
              以下の項目は再起動後に反映されます:{" "}
              {restartKeys
                .map((k) => fields.find((f) => f.key === k)?.label ?? k)
                .join(", ")}
            </div>
          )}

          {/* Save error */}
          {saveError && (
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
              {saveError}
            </div>
          )}

          {/* Properties card */}
          <div
            style={{
              backgroundColor: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "24px",
              marginBottom: "24px",
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
              server.properties
            </h2>

            {fields.length === 0 ? (
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                設定項目がありません。
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "20px",
                }}
              >
                {fields.map((field) => (
                  <div key={field.key}>
                    <PropertyFormField
                      field={field}
                      value={formValues[field.key] ?? ""}
                      readonly={!canOperate}
                      onChange={handleChange}
                    />
                    {validationErrors[field.key] && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "11px",
                          color: "var(--color-danger)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {validationErrors[field.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {canOperate && (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 28px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  backgroundColor: saving
                    ? "var(--color-accent-dim)"
                    : "var(--color-accent)",
                  color: saving ? "var(--color-accent)" : "#0d1117",
                  border: "none",
                  borderRadius: "4px",
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                {saving ? "保存中…" : "設定を保存"}
              </button>
              <Link
                href="/"
                style={{
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-text-secondary)";
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-muted)";
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                }}
              >
                ダッシュボードに戻る
              </Link>
            </div>
          )}
        </form>
      )}

      {/* ── リソース (メモリ) セクション ── */}
      <div
        style={{
          marginTop: "32px",
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
          リソース
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "12px",
            color: "var(--color-warning)",
            fontFamily: "var(--font-mono)",
            backgroundColor: "#3a2e10",
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid var(--color-warning)",
          }}
        >
          メモリ変更はコンテナの再作成を伴い、一時的に停止します。
        </p>

        <form onSubmit={(e) => void handleMemorySave(e)}>
          <div style={{ marginBottom: "16px", maxWidth: "280px" }}>
            <label
              htmlFor="memoryInput"
              style={{
                display: "block",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-text-secondary)",
                marginBottom: "6px",
              }}
            >
              メモリ (MB)
            </label>
            <input
              id="memoryInput"
              type="number"
              min={512}
              max={65536}
              step={1}
              value={memoryInput}
              disabled={!canOperate || memorySaving}
              onChange={(e) => {
                setMemoryInput(e.target.value);
                setMemoryError(null);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                backgroundColor: canOperate
                  ? "var(--color-bg-base)"
                  : "var(--color-bg-elevated)",
                border: `1px solid ${memoryError ? "var(--color-danger)" : "var(--color-border-muted)"}`,
                borderRadius: "4px",
                color: canOperate
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
                outline: "none",
                boxSizing: "border-box",
                cursor: canOperate ? "text" : "default",
              }}
              onFocus={(e) => {
                if (canOperate)
                  e.currentTarget.style.borderColor = "var(--color-accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = memoryError
                  ? "var(--color-danger)"
                  : "var(--color-border-muted)";
              }}
            />
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              512 〜 65536
            </p>
            {memoryError && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  color: "var(--color-danger)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {memoryError}
              </p>
            )}
          </div>

          {canOperate ? (
            <button
              type="submit"
              disabled={memorySaving}
              style={{
                padding: "9px 24px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                backgroundColor: memorySaving
                  ? "var(--color-accent-dim)"
                  : "var(--color-accent)",
                color: memorySaving ? "var(--color-accent)" : "#0d1117",
                border: "none",
                borderRadius: "4px",
                cursor: memorySaving ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
              }}
            >
              {memorySaving ? "適用中…(コンテナを再作成します)" : "保存"}
            </button>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-muted)",
              }}
            >
              閲覧専用モード — メモリの変更には operator 以上のロールが必要です。
            </p>
          )}
        </form>
      </div>

      {/* ── MOD 配置 (FTP) セクション ── */}
      <div
        style={{
          marginTop: "24px",
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "24px",
        }}
      >
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
          MOD 配置 (FTP)
        </h2>

        {ftpLoading ? (
          <div
            style={{
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Spinner size={14} />
            読み込み中…
          </div>
        ) : !ftpInfo ? (
          <div
            style={{
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            FTP 情報を取得できませんでした。
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Host */}
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-secondary)",
                  marginBottom: "6px",
                }}
              >
                ホスト
              </span>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  padding: "8px 12px",
                  backgroundColor: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: ftpInfo.host
                    ? "var(--color-text-primary)"
                    : "var(--color-text-muted)",
                  fontStyle: ftpInfo.host ? "normal" : "italic",
                  userSelect: "text",
                }}
              >
                {ftpInfo.host || "未設定（サーバーのホスト IP を使用）"}
              </div>
            </div>

            {/* Port */}
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-secondary)",
                  marginBottom: "6px",
                }}
              >
                ポート
              </span>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  padding: "8px 12px",
                  backgroundColor: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: "var(--color-text-primary)",
                  userSelect: "text",
                }}
              >
                {ftpInfo.port}
              </div>
            </div>

            {/* User */}
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-secondary)",
                  marginBottom: "6px",
                }}
              >
                ユーザー名
              </span>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  padding: "8px 12px",
                  backgroundColor: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: "var(--color-text-primary)",
                  userSelect: "text",
                }}
              >
                {ftpInfo.user}
              </div>
            </div>

            {/* MODs path for this server */}
            {serverFtpPath && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--color-text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  このサーバーの MOD 配置パス
                </span>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    padding: "8px 12px",
                    backgroundColor: "var(--color-bg-base)",
                    border: "1px solid var(--color-border-muted)",
                    borderRadius: "4px",
                    color: "var(--color-accent)",
                    userSelect: "text",
                    wordBreak: "break-all",
                  }}
                >
                  {serverFtpPath}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
