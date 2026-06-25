import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.ts";

/** `drizzle/` の SQL マイグレーションを SQLite に適用する。 */
mkdirSync(dirname(config.dbPath), { recursive: true });
const sqlite = new Database(config.dbPath);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" });
sqlite.close();
console.log(`[migrate] applied migrations to ${config.dbPath}`);
