import { Hono } from "hono";
import type { Server } from "../db/schema.ts";
import { type AppEnv, requireAuth } from "../middleware/auth.ts";
import { resolveJavaTag } from "../services/java-tags.ts";
import { getLoaderVersions } from "../services/versions.ts";

type LoaderType = Server["loaderType"];
const LOADERS: LoaderType[] = ["VANILLA", "FORGE", "NEOFORGE", "FABRIC"];

/** 作成ウィザード用のメタ情報(ローダー / バージョン一覧 / Java タグ)。 */
export const metaRoutes = new Hono<AppEnv>();

metaRoutes.use("*", requireAuth);

metaRoutes.get("/loaders", (c) => c.json({ loaders: LOADERS }));

/** 指定ローダーの選択可能バージョン一覧(§7)。 */
metaRoutes.get("/versions/:loader", async (c) => {
  const loader = c.req.param("loader").toUpperCase();
  if (!LOADERS.includes(loader as LoaderType)) {
    return c.json({ error: "unknown loader" }, 400);
  }
  try {
    const data = await getLoaderVersions(loader as LoaderType);
    return c.json(data);
  } catch (err) {
    return c.json(
      {
        error: "failed to fetch version metadata",
        detail: err instanceof Error ? err.message : undefined,
      },
      502,
    );
  }
});

/** MC バージョン + ローダーから自動決定される Java タグ(§6, UI プレビュー用)。 */
metaRoutes.get("/java-tag", (c) => {
  const mcVersion = c.req.query("mcVersion");
  const loader = (c.req.query("loader") ?? "").toUpperCase();
  if (!mcVersion || !LOADERS.includes(loader as LoaderType)) {
    return c.json({ error: "mcVersion and valid loader are required" }, 400);
  }
  return c.json({ javaTag: resolveJavaTag(mcVersion, loader as LoaderType) });
});
