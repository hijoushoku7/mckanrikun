import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** ユーザー(RBAC: admin / operator / viewer) */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "operator", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** ログインセッション(署名なしの不透明トークンを Cookie に保存) */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/** Minecraft サーバー(Docker コンテナ)のメタ情報 */
export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  loaderType: text("loader_type", {
    enum: ["VANILLA", "FORGE", "NEOFORGE", "FABRIC"],
  }).notNull(),
  mcVersion: text("mc_version").notNull(),
  loaderVersion: text("loader_version"),
  javaTag: text("java_tag").notNull(),
  memoryMb: integer("memory_mb").notNull(),
  gamePort: integer("game_port").notNull(),
  rconPort: integer("rcon_port").notNull(),
  rconPassword: text("rcon_password").notNull(),
  containerId: text("container_id"),
  eulaAccepted: integer("eula_accepted", { mode: "boolean" })
    .notNull()
    .default(false),
  statusCache: text("status_cache").notNull().default("unknown"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** 使用済みポートの記録・表示用(サーバー非依存の予約も扱える) */
export const portAllocations = sqliteTable("port_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  port: integer("port").notNull(),
  protocol: text("protocol", { enum: ["tcp", "udp"] })
    .notNull()
    .default("tcp"),
  purpose: text("purpose", { enum: ["game", "rcon", "ftp", "other"] })
    .notNull()
    .default("other"),
  serverId: text("server_id").references(() => servers.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Server = typeof servers.$inferSelect;
export type PortAllocation = typeof portAllocations.$inferSelect;

export type Role = User["role"];
