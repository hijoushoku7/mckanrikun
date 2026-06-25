"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Spinner";
import type { Role } from "@/lib/types";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: Role;
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      // Not admin — redirect to dashboard
      router.replace("/");
    }
  }, [user, loading, requiredRole, router]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          gap: "12px",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
        }}
      >
        <Spinner size={24} />
        <span>認証中…</span>
      </div>
    );
  }

  if (!user) return null;

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              color: "var(--color-danger)",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          >
            403 Forbidden
          </p>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>
            このページは {requiredRole} 以上のロールが必要です。
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
