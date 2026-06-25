/**
 * 本アプリが管理する Docker コンテナを識別するためのラベル。
 * 再起動後もこのラベルで自分の管理対象を再認識する(要件 §5 / 非機能「復旧性」)。
 */
export const LABEL_MANAGED = "mc-manager.managed";
export const LABEL_SERVER_ID = "mc-manager.server-id";
export const LABEL_SERVER_NAME = "mc-manager.server-name";

/** 管理対象コンテナに付与する基本ラベル集合を組み立てる。 */
export const buildManagedLabels = (
  serverId: string,
  serverName: string,
): Record<string, string> => ({
  [LABEL_MANAGED]: "true",
  [LABEL_SERVER_ID]: serverId,
  [LABEL_SERVER_NAME]: serverName,
});

/** dockerode の list フィルタ用(管理対象のみ抽出)。 */
export const managedFilter = {
  label: [`${LABEL_MANAGED}=true`],
};

/** コンテナのラベルから server-id を取り出す(無ければ null)。 */
export const serverIdFromLabels = (
  labels: Record<string, string> | undefined,
): string | null => labels?.[LABEL_SERVER_ID] ?? null;
