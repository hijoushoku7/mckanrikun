import { randomBytes } from "node:crypto";
import { config } from "../config.ts";
import { createUser, getUserByUsername } from "../services/users.ts";

/**
 * 初期 admin ユーザーを作成する。冪等: 既に同名ユーザーがいれば何もしない。
 * パスワードは INITIAL_ADMIN_PASSWORD 環境変数。未指定ならランダム生成して表示。
 */
const main = async (): Promise<void> => {
  const username = config.initialAdminUser;

  if (getUserByUsername(username)) {
    console.log(`[seed] user "${username}" already exists; skipping`);
    return;
  }

  let password = config.initialAdminPassword;
  let generated = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }

  await createUser({ username, password, role: "admin" });

  console.log(`[seed] created admin user "${username}"`);
  if (generated) {
    console.log("[seed] generated password (記録してください):");
    console.log(`       ${password}`);
  }
};

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
