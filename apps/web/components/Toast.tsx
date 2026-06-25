"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

let listeners: Array<(msg: ToastMessage) => void> = [];

export function toast(message: string, variant: ToastVariant = "info") {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach((fn) => fn({ id, message, variant }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    function handler(msg: ToastMessage) {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 4000);
    }
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((fn) => fn !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      role="region"
      aria-label="通知"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.variant === "error" ? "alert" : undefined}
          style={{
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            backgroundColor:
              t.variant === "success"
                ? "#1a3a20"
                : t.variant === "error"
                  ? "#3a1a1a"
                  : "var(--color-bg-elevated)",
            border: `1px solid ${
              t.variant === "success"
                ? "var(--color-success)"
                : t.variant === "error"
                  ? "var(--color-danger)"
                  : "var(--color-border-muted)"
            }`,
            color:
              t.variant === "success"
                ? "var(--color-success)"
                : t.variant === "error"
                  ? "var(--color-danger)"
                  : "var(--color-text-primary)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            maxWidth: "360px",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
