"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, login } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → redirect
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      await refresh();
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Username or password is incorrect.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) return null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-bg-base)",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: "18px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              marginBottom: "8px",
            }}
          >
            MC管理くん
          </div>
          <div className="pixel-border" style={{ marginBottom: "8px" }} />
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            Minecraft Server Management Console
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "28px",
          }}
        >
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="username"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-secondary)",
                  marginBottom: "6px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-muted)";
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-secondary)",
                  marginBottom: "6px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "4px",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-muted)";
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  marginBottom: "16px",
                  backgroundColor: "#3a1a1a",
                  border: "1px solid var(--color-danger)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-danger)",
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                letterSpacing: "0.06em",
                backgroundColor: submitting
                  ? "var(--color-accent-dim)"
                  : "var(--color-accent)",
                color: submitting ? "var(--color-accent)" : "#0d1117",
                border: "none",
                borderRadius: "4px",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background-color 0.15s",
              }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
