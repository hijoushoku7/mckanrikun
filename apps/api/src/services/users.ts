import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users, type Role, type User } from "../db/schema.ts";
import { newId } from "../lib/crypto.ts";
import { hashPassword } from "./auth.ts";

export const ROLES: readonly Role[] = ["admin", "operator", "viewer"];

/** API レスポンス用に password_hash を除いた公開ビュー。 */
export type PublicUser = Omit<User, "passwordHash">;

export const toPublicUser = (u: User): PublicUser => {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
};

export const listUsers = (): PublicUser[] =>
  db.select().from(users).all().map(toPublicUser);

export const getUser = (id: string): User | undefined =>
  db.select().from(users).where(eq(users.id, id)).get();

export const getUserByUsername = (username: string): User | undefined =>
  db.select().from(users).where(eq(users.username, username)).get();

export interface CreateUserInput {
  username: string;
  password: string;
  role: Role;
}

export const createUser = async (
  input: CreateUserInput,
): Promise<PublicUser> => {
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const user: User = {
    id: newId(),
    username: input.username,
    passwordHash,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(users).values(user).run();
  return toPublicUser(user);
};

export interface UpdateUserInput {
  role?: Role;
  password?: string;
}

export const updateUser = async (
  id: string,
  input: UpdateUserInput,
): Promise<PublicUser | null> => {
  const existing = getUser(id);
  if (!existing) return null;

  const patch: Partial<User> = { updatedAt: new Date() };
  if (input.role) patch.role = input.role;
  if (input.password) patch.passwordHash = await hashPassword(input.password);

  db.update(users).set(patch).where(eq(users.id, id)).run();
  return toPublicUser({ ...existing, ...patch });
};

export const deleteUser = (id: string): void => {
  db.delete(users).where(eq(users.id, id)).run();
};

/** admin の人数を数える(最後の admin 削除/降格を防ぐ用)。 */
export const countAdmins = (): number =>
  db.select().from(users).where(eq(users.role, "admin")).all().length;

export const isValidRole = (v: unknown): v is Role =>
  typeof v === "string" && (ROLES as readonly string[]).includes(v);
