"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div
        style={{
          display: "flex",
          minHeight: "100dvh",
        }}
      >
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
