"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import type { Role } from "@/lib/types";

/** Sandstone app frame: auth gate + sidebar + stone-surface main. */
export function AppShell({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: Role;
}) {
  return (
    <AuthGuard requiredRole={requiredRole}>
      <div style={{ display: "flex", minHeight: "100dvh" }}>
        <Sidebar />
        <main
          className="stone-surface"
          style={{
            flex: 1,
            padding: "36px 40px",
            overflowY: "auto",
            fontFamily: "var(--font-display)",
            color: "var(--ink)",
          }}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
