import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.ts";
import type { Server } from "../db/schema.ts";
import { inRange } from "../lib/version.ts";

type LoaderType = Server["loaderType"];

interface TagRule {
  tag: string;
  min: string | null;
  max: string | null;
}

interface JavaTagConfig {
  default: string;
  rules: TagRule[];
  loaderOverrides?: Partial<Record<LoaderType, TagRule[]>>;
}

let cached: JavaTagConfig | null = null;

const load = (): JavaTagConfig => {
  if (cached) return cached;
  const path = resolve(process.cwd(), config.javaTagsPath);
  cached = JSON.parse(readFileSync(path, "utf8")) as JavaTagConfig;
  return cached;
};

const matchRules = (rules: TagRule[], mcVersion: string): string | null => {
  for (const r of rules) {
    if (inRange(mcVersion, r.min, r.max)) return r.tag;
  }
  return null;
};

/**
 * MC バージョン(+ ローダー種別)から itzg の Java タグを自動決定する(要件 §6)。
 * ローダー固有の上書きを優先し、無ければ汎用ルール、最後に default。
 */
export const resolveJavaTag = (
  mcVersion: string,
  loaderType: LoaderType,
): string => {
  const cfg = load();
  const override = cfg.loaderOverrides?.[loaderType];
  if (override) {
    const tag = matchRules(override, mcVersion);
    if (tag) return tag;
  }
  return matchRules(cfg.rules, mcVersion) ?? cfg.default;
};

/** テスト・設定再読込用。 */
export const resetJavaTagCache = (): void => {
  cached = null;
};
