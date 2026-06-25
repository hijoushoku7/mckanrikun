import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.ts";
import { parseProperties, updateProperties } from "../lib/properties.ts";

/** 編集可能フィールドの定義(GUI フォーム生成 + バリデーションに使用)。 */
export type FieldType = "bool" | "int" | "enum" | "string";

export interface PropertyField {
  key: string;
  label: string;
  type: FieldType;
  /** enum 型の選択肢。 */
  options?: string[];
  /** int 型の範囲。 */
  min?: number;
  max?: number;
  /** 反映に再起動が必要か(server.properties は起動時に読まれる)。 */
  requiresRestart: boolean;
}

/**
 * 主要な編集対象(要件 FR-4)。server-port / rcon 系は itzg が env で管理するため
 * GUI からは編集対象にしない(競合回避)。ここに挙げたキーは itzg の env 制御外で、
 * ファイル直接編集が再起動後も保持される。すべて反映に再起動が必要。
 */
export const EDITABLE_PROPERTIES: PropertyField[] = [
  { key: "motd", label: "MOTD(サーバー説明)", type: "string", requiresRestart: true },
  {
    key: "difficulty",
    label: "難易度",
    type: "enum",
    options: ["peaceful", "easy", "normal", "hard"],
    requiresRestart: true,
  },
  {
    key: "gamemode",
    label: "ゲームモード",
    type: "enum",
    options: ["survival", "creative", "adventure", "spectator"],
    requiresRestart: true,
  },
  { key: "max-players", label: "最大プレイヤー数", type: "int", min: 1, max: 1000, requiresRestart: true },
  { key: "pvp", label: "PvP", type: "bool", requiresRestart: true },
  { key: "online-mode", label: "オンラインモード(認証)", type: "bool", requiresRestart: true },
  { key: "view-distance", label: "描画距離", type: "int", min: 3, max: 32, requiresRestart: true },
  { key: "simulation-distance", label: "シミュレーション距離", type: "int", min: 3, max: 32, requiresRestart: true },
  { key: "hardcore", label: "ハードコア", type: "bool", requiresRestart: true },
  { key: "white-list", label: "ホワイトリスト", type: "bool", requiresRestart: true },
  { key: "spawn-protection", label: "スポーン保護範囲", type: "int", min: 0, max: 1000, requiresRestart: true },
  { key: "allow-nether", label: "ネザー許可", type: "bool", requiresRestart: true },
  { key: "allow-flight", label: "飛行許可", type: "bool", requiresRestart: true },
  { key: "enable-command-block", label: "コマンドブロック有効", type: "bool", requiresRestart: true },
  { key: "level-name", label: "ワールド名", type: "string", requiresRestart: true },
  { key: "level-seed", label: "シード値", type: "string", requiresRestart: true },
];

const FIELD_BY_KEY = new Map(EDITABLE_PROPERTIES.map((f) => [f.key, f]));

const propertiesPath = (serverId: string): string =>
  resolve(process.cwd(), config.serverDataRoot, serverId, "server.properties");

export class PropertiesNotFoundError extends Error {
  constructor() {
    super("server.properties not found (start the server once to generate it)");
    this.name = "PropertiesNotFoundError";
  }
}

/** 編集対象キーの現在値を返す(存在するキーのみ)。 */
export const getServerProperties = (
  serverId: string,
): Record<string, string> => {
  const path = propertiesPath(serverId);
  if (!existsSync(path)) throw new PropertiesNotFoundError();
  const all = parseProperties(readFileSync(path, "utf8"));
  const out: Record<string, string> = {};
  for (const field of EDITABLE_PROPERTIES) {
    if (field.key in all) out[field.key] = all[field.key]!;
  }
  return out;
};

/** 単一フィールドの値を検証し、正規化した文字列を返す。不正なら Error を投げる。 */
const validateValue = (field: PropertyField, raw: unknown): string => {
  switch (field.type) {
    case "bool": {
      if (typeof raw === "boolean") return raw ? "true" : "false";
      if (raw === "true" || raw === "false") return raw;
      throw new Error(`${field.key} must be a boolean`);
    }
    case "int": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isInteger(n)) throw new Error(`${field.key} must be an integer`);
      if (field.min !== undefined && n < field.min) {
        throw new Error(`${field.key} must be >= ${field.min}`);
      }
      if (field.max !== undefined && n > field.max) {
        throw new Error(`${field.key} must be <= ${field.max}`);
      }
      return String(n);
    }
    case "enum": {
      if (typeof raw !== "string" || !field.options?.includes(raw)) {
        throw new Error(`${field.key} must be one of: ${field.options?.join(", ")}`);
      }
      return raw;
    }
    case "string": {
      if (typeof raw !== "string") throw new Error(`${field.key} must be a string`);
      // 改行はプロパティを壊すため禁止。
      if (/[\r\n]/.test(raw)) throw new Error(`${field.key} must not contain newlines`);
      return raw;
    }
  }
};

export interface SaveResult {
  updated: Record<string, string>;
  /** 反映に再起動が必要なキー。 */
  requiresRestart: string[];
}

/**
 * 編集対象のみを検証し server.properties に反映する。
 * 未知キーは拒否(ホワイトリスト方式でインジェクション/破壊を防ぐ)。
 */
export const saveServerProperties = (
  serverId: string,
  updates: Record<string, unknown>,
): SaveResult => {
  const path = propertiesPath(serverId);
  if (!existsSync(path)) throw new PropertiesNotFoundError();

  const validated: Record<string, string> = {};
  const requiresRestart: string[] = [];
  for (const [key, raw] of Object.entries(updates)) {
    const field = FIELD_BY_KEY.get(key);
    if (!field) throw new Error(`unknown or non-editable property: ${key}`);
    validated[key] = validateValue(field, raw);
    if (field.requiresRestart) requiresRestart.push(key);
  }

  const next = updateProperties(readFileSync(path, "utf8"), validated);
  writeFileSync(path, next, "utf8");

  return { updated: validated, requiresRestart };
};
