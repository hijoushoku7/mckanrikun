import { Hono } from "hono";
import { type AppEnv, requireAuth, requireRole } from "../middleware/auth.ts";
import {
  countAdmins,
  createUser,
  deleteUser,
  getUser,
  getUserByUsername,
  isValidRole,
  listUsers,
  updateUser,
} from "../services/users.ts";

/** ユーザー管理 API。全エンドポイント admin 限定。 */
export const userRoutes = new Hono<AppEnv>();

userRoutes.use("*", requireAuth, requireRole("admin"));

userRoutes.get("/", (c) => c.json({ users: listUsers() }));

userRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role;

  if (username.length < 3) {
    return c.json({ error: "username must be at least 3 characters" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "password must be at least 8 characters" }, 400);
  }
  if (!isValidRole(role)) {
    return c.json({ error: "invalid role" }, 400);
  }
  if (getUserByUsername(username)) {
    return c.json({ error: "username already exists" }, 409);
  }

  const user = await createUser({ username, password, role });
  return c.json({ user }, 201);
});

userRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const target = getUser(id);
  if (!target) return c.json({ error: "not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const role = body?.role;
  const password = body?.password;

  if (role !== undefined && !isValidRole(role)) {
    return c.json({ error: "invalid role" }, 400);
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
    return c.json({ error: "password must be at least 8 characters" }, 400);
  }
  // 最後の admin を降格させない。
  if (
    role !== undefined &&
    role !== "admin" &&
    target.role === "admin" &&
    countAdmins() <= 1
  ) {
    return c.json({ error: "cannot demote the last admin" }, 409);
  }

  const updated = await updateUser(id, { role, password });
  return c.json({ user: updated });
});

userRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const target = getUser(id);
  if (!target) return c.json({ error: "not found" }, 404);

  if (target.id === c.get("user").id) {
    return c.json({ error: "cannot delete yourself" }, 409);
  }
  if (target.role === "admin" && countAdmins() <= 1) {
    return c.json({ error: "cannot delete the last admin" }, 409);
  }

  deleteUser(id);
  return c.json({ ok: true });
});
