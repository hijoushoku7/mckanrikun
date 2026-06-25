/**
 * `.properties`(server.properties)の最小パーサ / エディタ。
 * コメント・空行・未知キーを保持したまま、既知キーの値のみ更新する。
 */

/** テキストを key→value のマップにパースする(コメント/空行は無視)。 */
export const parseProperties = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (key) out[key] = value;
  }
  return out;
};

/**
 * 既存テキストに updates をマージして新テキストを返す。
 * - 既存行のキーは値だけ差し替え(コメント・順序・未知キーを保持)。
 * - 既存に無いキーは末尾へ追記。
 */
export const updateProperties = (
  text: string,
  updates: Record<string, string>,
): string => {
  const remaining = new Map(Object.entries(updates));
  const lines = text.split(/\r?\n/);

  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) {
      return line;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 0) return line;
    const key = trimmed.slice(0, eq).trim();
    if (remaining.has(key)) {
      const value = remaining.get(key)!;
      remaining.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });

  // 末尾の余分な空行を避けつつ、新規キーを追記。
  if (remaining.size > 0) {
    while (result.length > 0 && result[result.length - 1]!.trim() === "") {
      result.pop();
    }
    for (const [key, value] of remaining) {
      result.push(`${key}=${value}`);
    }
  }

  return result.join("\n");
};
