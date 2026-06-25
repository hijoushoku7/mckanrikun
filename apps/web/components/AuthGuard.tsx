"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-text-secondary)] font-mono text-sm">
          Authenticating…
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-[var(--color-danger)] font-mono text-sm mb-2">
            403 Forbidden
          </p>
          <p className="text-[var(--color-text-secondary)] text-sm">
            This page requires {requiredRole} access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
