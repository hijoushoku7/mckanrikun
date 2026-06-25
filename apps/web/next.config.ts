import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  // コンテナ配布用: 依存を同梱した最小ランタイムを出力する。
  output: "standalone",
  // npm workspaces モノレポのため、トレースのルートをリポジトリ直下に固定する。
  outputFileTracingRoot: join(import.meta.dirname, "../../"),
};

export default nextConfig;
