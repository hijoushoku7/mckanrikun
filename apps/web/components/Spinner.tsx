"use client";

/**
 * 共通ローディングスピナー
 * 純 CSS アニメーション。外部パッケージ不要。
 */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <>
      <style>{`
        @keyframes mc-spin {
          to { transform: rotate(360deg); }
        }
        .mc-spinner {
          display: inline-block;
          border-radius: 50%;
          border-style: solid;
          border-color: var(--color-border-muted);
          border-top-color: var(--color-accent);
          animation: mc-spin 0.7s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mc-spinner { animation: none; opacity: 0.5; }
        }
      `}</style>
      <span
        className="mc-spinner"
        role="status"
        aria-label="読み込み中"
        style={{
          width: size,
          height: size,
          borderWidth: Math.max(2, Math.round(size / 6)),
        }}
      />
    </>
  );
}

/** ページ中央に大きめのスピナーを表示するブロック */
export function LoadingBlock({ label = "読み込み中…" }: { label?: string }) {
  return (
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
      <span>{label}</span>
    </div>
  );
}
