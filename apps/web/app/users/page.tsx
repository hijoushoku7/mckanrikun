"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Panel, LoadingState, EmptyState } from "@/components/mc";
import { toast } from "@/components/Toast";
import { ApiError, createUser, deleteUser, listUsers, updateUser } from "@/lib/api";
import type { PublicUser, Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "operator", "viewer"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "管理者",
  operator: "オペレーター",
  viewer: "閲覧者",
};

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
    <AppShell requiredRole="admin">
      <UsersContent />
    </AppShell>
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
      toast("ユーザー一覧の取得に失敗しました。", "error");
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
      toast(`ユーザー「${created.username}」を作成しました。`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast(`ユーザー名「${newUsername}」は既に使われています。`, "error");
      } else if (err instanceof ApiError && err.status === 400) {
        toast("入力が不正です。ユーザー名とパスワードを確認してください。", "error");
      } else {
        toast("ユーザーの作成に失敗しました。", "error");
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
      toast(`ロールを「${ROLE_LABEL[role]}」に変更しました。`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast("最後の管理者のロールは変更できません。", "error");
      } else {
        toast("ロールの変更に失敗しました。", "error");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(user: PublicUser) {
    if (!window.confirm(`ユーザー「${user.username}」を削除しますか？この操作は元に戻せません。`))
      return;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast(`ユーザー「${user.username}」を削除しました。`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast("最後の管理者アカウントは削除できません。", "error");
      } else if (err instanceof ApiError && err.status === 404) {
        toast("ユーザーが見つかりません。", "error");
      } else {
        toast("ユーザーの削除に失敗しました。", "error");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        eyebrow="ACCESS CONTROL"
        title="ユーザー管理"
        subtitle="コンソールへのアクセス権限とロールを管理します。"
      />

      {/* Create user */}
      <Panel title="ユーザー追加" padded style={{ marginBottom: 22 }}>
        <form
          onSubmit={(e) => void handleCreate(e)}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}
        >
          <input
            type="text"
            className="mc-input"
            placeholder="ユーザー名"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
            autoComplete="off"
            style={{ flex: "1 1 160px", width: "auto" }}
          />
          <input
            type="password"
            className="mc-input"
            placeholder="パスワード"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{ flex: "1 1 160px", width: "auto" }}
          />
          <select
            className="mc-select"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            style={{ flex: "0 0 150px" }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button type="submit" className="mc-btn mc-btn--grass" disabled={creating}>
            {creating ? "追加中…" : "追加"}
          </button>
        </form>
      </Panel>

      {/* Users table */}
      <Panel title="USERS" meta={`${users.length} 件`}>
        {loadingUsers ? (
          <LoadingState />
        ) : users.length === 0 ? (
          <EmptyState message="ユーザーがいません" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  {["ユーザー名", "ロール", "作成日時", "操作"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600 }}>{user.username}</td>
                    <td>
                      <select
                        className="mc-select"
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) => void handleRoleChange(user, e.target.value as Role)}
                        style={{ fontSize: 12, padding: "5px 26px 5px 10px" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mc-btn mc-btn--redstone"
                        onClick={() => void handleDelete(user)}
                        disabled={deletingId === user.id}
                        style={{ fontSize: 12, padding: "6px 12px" }}
                      >
                        {deletingId === user.id ? "削除中…" : "削除"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
