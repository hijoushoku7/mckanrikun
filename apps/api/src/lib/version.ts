/**
 * Minecraft バージョン文字列(例 "1.20.4", "1.21", "1.16.5")の比較ユーティリティ。
 * 厳密な semver ではなくドット区切りの数値列として比較する。
 * 非数値サフィックス(スナップショット等)は数値部分のみで比較し、残りは無視する。
 */
const parse = (v: string): number[] =>
  v
    .split(".")
    .map((seg) => {
      const n = Number.parseInt(seg, 10);
      return Number.isNaN(n) ? 0 : n;
    });

/** a < b なら負、a > b なら正、等しければ 0。長さ違いは不足分を 0 とみなす。 */
export const compareMcVersion = (a: string, b: string): number => {
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
};

/** version が [min, max](両端含む, null は無制限)の範囲内か。 */
export const inRange = (
  version: string,
  min: string | null,
  max: string | null,
): boolean => {
  if (min !== null && compareMcVersion(version, min) < 0) return false;
  if (max !== null && compareMcVersion(version, max) > 0) return false;
  return true;
};
