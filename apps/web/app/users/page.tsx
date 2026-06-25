"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "@/components/Toast";
import {
  ApiError,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/api";
import type { PublicUser, Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "operator", "viewer"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UsersPage() {
  return (
    <AuthGuard requiredRole="admin">
      <div style={{ display: "flex", minHeight: "100dvh" }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            padding: "32px",
            overflowY: "auto",
            backgroundColor: "var(--color-bg-base)",
          }}
        >
          <UsersContent />
        </main>
      </div>
    </AuthGuard>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      toast("Failed to load users.", "error");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await createUser({
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      setUsers((prev) => [...prev, created]);
      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      toast(`User "${created.username}" created.`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast(`Username "${newUsername}" is already taken.`, "error");
      } else if (err instanceof ApiError && err.status === 400) {
        toast("Invalid input. Check username and password.", "error");
      } else {
        toast("Failed to create user.", "error");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(user: PublicUser, role: Role) {
    setUpdatingId(user.id);
    try {
      const updated = await updateUser(user.id, { role });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast(`Role updated to "${role}".`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast("Cannot change role: this is the last admin.", "error");
      } else {
        toast("Failed to update role.", "error");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(user: PublicUser) {
    if (
      !window.confirm(
        `Delete user "${user.username}"? This cannot be undone.`
      )
    )
      return;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast(`User "${user.username}" deleted.`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast("Cannot delete the last admin account.", "error");
      } else if (err instanceof ApiError && err.status === 404) {
        toast("User not found.", "error");
      } else {
        toast("Failed to delete user.", "error");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--color-bg-base)",
    border: "1px solid var(--color-border-muted)",
    borderRadius: "4px",
    color: "var(--color-text-primary)",
    outline: "none",
  };

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "20px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          User Management
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          Manage console access and roles.
        </p>
      </div>

      {/* Create user form */}
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Add user
        </h2>
        <form
          onSubmit={(e) => void handleCreate(e)}
          style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
        >
          <input
            type="text"
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
            style={{ ...inputStyle, flex: "1 1 160px" }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={{ ...inputStyle, flex: "1 1 160px" }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-muted)";
            }}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            style={{
              ...inputStyle,
              flex: "0 0 120px",
              cursor: "pointer",
              appearance: "none",
              paddingRight: "28px",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b949e'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              backgroundColor: creating
                ? "var(--color-accent-dim)"
                : "var(--color-accent)",
              color: creating ? "var(--color-accent)" : "#0d1117",
              border: "none",
              borderRadius: "4px",
              cursor: creating ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {creating ? "Adding…" : "Add user"}
          </button>
        </form>
      </div>

      {/* Users table */}
      <div
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Users
          </h2>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            {users.length} total
          </span>
        </div>

        {loadingUsers ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
            }}
          >
            Loading…
          </div>
        ) : users.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "13px",
            }}
          >
            No users found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg-elevated)",
                  }}
                >
                  {["Username", "Role", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom:
                        idx < users.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {user.username}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) =>
                          void handleRoleChange(user, e.target.value as Role)
                        }
                        style={{
                          padding: "4px 24px 4px 8px",
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          backgroundColor: "var(--color-bg-base)",
                          border: "1px solid var(--color-border-muted)",
                          borderRadius: "4px",
                          color: "var(--color-text-primary)",
                          cursor:
                            updatingId === user.id ? "wait" : "pointer",
                          appearance: "none",
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b949e'/%3E%3C/svg%3E")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 6px center",
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--color-text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => void handleDelete(user)}
                        disabled={deletingId === user.id}
                        style={{
                          padding: "4px 12px",
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          backgroundColor: "transparent",
                          border: "1px solid var(--color-border-muted)",
                          borderRadius: "4px",
                          color: "var(--color-text-secondary)",
                          cursor:
                            deletingId === user.id ? "wait" : "pointer",
                          transition: "border-color 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (deletingId !== user.id) {
                            e.currentTarget.style.borderColor =
                              "var(--color-danger)";
                            e.currentTarget.style.color =
                              "var(--color-danger)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            "var(--color-border-muted)";
                          e.currentTarget.style.color =
                            "var(--color-text-secondary)";
                        }}
                      >
                        {deletingId === user.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
