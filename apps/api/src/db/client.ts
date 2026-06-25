import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

// DB ファイルのディレクトリを確実に用意する。
mkdirSync(dirname(config.dbPath), { recursive: true });

const sqlite = new Database(config.dbPath);
// 同時アクセス耐性と整合性のための PRAGMA。
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
