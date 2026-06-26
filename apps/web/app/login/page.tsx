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

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-pixel)",
    fontSize: 9,
    letterSpacing: "0.08em",
    color: "var(--ink-soft)",
    marginBottom: 8,
  };

  return (
    <div
      className="stone-surface"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-display)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <span
            className="block-icon"
            style={{
              width: 52,
              height: 52,
              backgroundColor: "var(--grass)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{ fontFamily: "var(--font-pixel)", fontSize: 15, color: "#f3f7ee" }}
            >
              MC
            </span>
          </span>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>
              管理くん
            </div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 8,
                letterSpacing: "0.06em",
                color: "var(--ink-mute)",
                marginTop: 4,
              }}
            >
              SERVER CONSOLE
            </div>
          </div>
        </div>

        {/* GUI panel */}
        <div className="mc-panel" style={{ padding: 26 }}>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="username" style={labelStyle}>
                USERNAME
              </label>
              <input
                id="username"
                type="text"
                className="mc-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label htmlFor="password" style={labelStyle}>
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                className="mc-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mc-slot"
                style={{
                  padding: "10px 12px",
                  marginBottom: 16,
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  color: "#ffd9d3",
                  backgroundColor: "var(--redstone-lo)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mc-btn mc-btn--grass"
              disabled={submitting}
              style={{ width: "100%", padding: 12, fontSize: 14 }}
            >
              {submitting ? "サインイン中…" : "サインイン"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
