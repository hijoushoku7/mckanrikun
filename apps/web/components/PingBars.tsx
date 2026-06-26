"use client";

import type { ServerStatus, LoaderType } from "@/lib/types";

// ── Loader identity: every loader gets its own block color & label ──
const LOADER: Record<LoaderType, { color: string; label: string }> = {
  VANILLA: { color: "var(--loader-vanilla)", label: "Vanilla" },
  FABRIC: { color: "var(--loader-fabric)", label: "Fabric" },
  FORGE: { color: "var(--loader-forge)", label: "Forge" },
  NEOFORGE: { color: "var(--loader-neoforge)", label: "NeoForge" },
};

export function loaderColor(t: LoaderType): string {
  return LOADER[t]?.color ?? "var(--ink-mute)";
}
export function loaderLabel(t: LoaderType): string {
  return LOADER[t]?.label ?? t;
}

/** A Minecraft block sitting in a recessed slot — colored by loader. */
export function LoaderBlock({ loader, size = 44 }: { loader: LoaderType; size?: number }) {
  return (
    <span
      className="mc-slot"
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 5,
      }}
    >
      <span
        className="block-icon"
        style={{ width: "100%", height: "100%", backgroundColor: loaderColor(loader) }}
        aria-hidden
      />
    </span>
  );
}

// ── Connection bars: the MC multiplayer "ping" icon, repurposed as live status ──
const STATUS: Record<
  ServerStatus,
  { label: string; color: string; filled: number; pulse?: boolean }
> = {
  running: { label: "RUNNING", color: "var(--grass)", filled: 5 },
  starting: { label: "STARTING", color: "var(--gold)", filled: 3, pulse: true },
  stopping: { label: "STOPPING", color: "var(--gold)", filled: 2, pulse: true },
  stopped: { label: "STOPPED", color: "var(--ink-mute)", filled: 0 },
  error: { label: "ERROR", color: "var(--redstone)", filled: 5 },
  unknown: { label: "UNKNOWN", color: "var(--ink-mute)", filled: 0 },
};

export function PingBars({ status }: { status: ServerStatus }) {
  const m = STATUS[status] ?? STATUS.unknown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        role="img"
        aria-label={m.label}
        style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 18 }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i < m.filled;
          return (
            <span
              key={i}
              style={{
                width: 4,
                height: 6 + i * 3,
                backgroundColor: on ? m.color : "transparent",
                border: `1px solid ${on ? m.color : "var(--ink-mute)"}`,
                opacity: on ? 1 : 0.45,
                animation: m.pulse && on ? "mc-pulse 1s ease-in-out infinite" : undefined,
              }}
            />
          );
        })}
      </span>
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 9,
          letterSpacing: "0.04em",
          color: m.color,
          whiteSpace: "nowrap",
        }}
      >
        {m.label}
      </span>
    </span>
  );
}
