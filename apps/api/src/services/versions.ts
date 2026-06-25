import { config } from "../config.ts";
import type { Server } from "../db/schema.ts";
import { compareMcVersion } from "../lib/version.ts";

type LoaderType = Server["loaderType"];

export interface LoaderVersions {
  loader: LoaderType;
  /** 選択可能な MC バージョン(新しい順)。 */
  mcVersions: string[];
  /** Forge / NeoForge: MC バージョンごとのローダーバージョン(新しい順)。 */
  loaderVersionsByMc?: Record<string, string[]>;
  /** Fabric: MC に依存しないローダーバージョン(新しい順)。 */
  loaderVersions?: string[];
  /** フォールバック(前回値)を返したか。 */
  stale?: boolean;
}

const META_URLS = {
  vanilla: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  fabricGame: "https://meta.fabricmc.net/v2/versions/game",
  fabricLoader: "https://meta.fabricmc.net/v2/versions/loader",
  neoforge:
    "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml",
  forge:
    "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml",
} as const;

const sortMcDesc = (a: string, b: string): number => -compareMcVersion(a, b);

const fetchText = async (url: string): Promise<string> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
};

/** maven-metadata.xml から <version> を全て抽出。 */
const parseMavenVersions = (xml: string): string[] => {
  const out: string[] = [];
  const re = /<version>([^<]+)<\/version>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) out.push(m[1].trim());
  }
  return out;
};

const fetchVanilla = async (): Promise<LoaderVersions> => {
  const data = await fetchJson<{
    versions: Array<{ id: string; type: string }>;
  }>(META_URLS.vanilla);
  const mcVersions = data.versions
    .filter((v) => v.type === "release")
    .map((v) => v.id);
  return { loader: "VANILLA", mcVersions };
};

const fetchFabric = async (): Promise<LoaderVersions> => {
  const [games, loaders] = await Promise.all([
    fetchJson<Array<{ version: string; stable: boolean }>>(META_URLS.fabricGame),
    fetchJson<Array<{ version: string; stable: boolean }>>(
      META_URLS.fabricLoader,
    ),
  ]);
  return {
    loader: "FABRIC",
    mcVersions: games.filter((g) => g.stable).map((g) => g.version),
    loaderVersions: loaders.map((l) => l.version),
  };
};

/** NeoForge: バージョン "20.4.237" → MC "1.20.4"(末尾 .0 は "1.21" のように省く)。 */
const neoforgeMcVersion = (v: string): string | null => {
  const parts = v.split(".");
  if (parts.length < 2) return null;
  const [major, minor] = parts;
  if (!/^\d+$/.test(major ?? "") || !/^\d+$/.test(minor ?? "")) return null;
  return minor === "0" ? `1.${major}` : `1.${major}.${minor}`;
};

const groupByMc = (
  pairs: Array<{ mc: string; loaderVersion: string }>,
): { mcVersions: string[]; loaderVersionsByMc: Record<string, string[]> } => {
  const map: Record<string, string[]> = {};
  for (const { mc, loaderVersion } of pairs) {
    (map[mc] ??= []).push(loaderVersion);
  }
  for (const mc of Object.keys(map)) {
    // ローダーバージョンは文字列降順(新しい版が概ね先頭)。
    map[mc]!.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }
  const mcVersions = Object.keys(map).sort(sortMcDesc);
  return { mcVersions, loaderVersionsByMc: map };
};

const fetchNeoForge = async (): Promise<LoaderVersions> => {
  const versions = parseMavenVersions(await fetchText(META_URLS.neoforge));
  const pairs = versions
    .filter((v) => !/-beta|-rc|-pre/i.test(v))
    .map((v) => ({ mc: neoforgeMcVersion(v), loaderVersion: v }))
    .filter((p): p is { mc: string; loaderVersion: string } => p.mc !== null);
  return { loader: "NEOFORGE", ...groupByMc(pairs) };
};

/** Forge: バージョン "1.20.1-47.2.0" → MC "1.20.1", ローダー "47.2.0"。 */
const fetchForge = async (): Promise<LoaderVersions> => {
  const versions = parseMavenVersions(await fetchText(META_URLS.forge));
  const pairs = versions
    .map((v) => {
      const idx = v.indexOf("-");
      if (idx < 0) return null;
      return { mc: v.slice(0, idx), loaderVersion: v.slice(idx + 1) };
    })
    .filter((p): p is { mc: string; loaderVersion: string } => p !== null);
  return { loader: "FORGE", ...groupByMc(pairs) };
};

const FETCHERS: Record<LoaderType, () => Promise<LoaderVersions>> = {
  VANILLA: fetchVanilla,
  FABRIC: fetchFabric,
  NEOFORGE: fetchNeoForge,
  FORGE: fetchForge,
};

interface CacheEntry {
  data: LoaderVersions;
  fetchedAt: number;
}
const cache = new Map<LoaderType, CacheEntry>();

/**
 * 指定ローダーのバージョン一覧を取得(§7)。TTL 内はキャッシュを返し、
 * API 障害時は前回値(stale)で代替する。前回値も無ければ例外。
 */
export const getLoaderVersions = async (
  loader: LoaderType,
): Promise<LoaderVersions> => {
  const now = Date.now();
  const entry = cache.get(loader);
  if (entry && now - entry.fetchedAt < config.versionCacheTtlMs) {
    return entry.data;
  }
  try {
    const data = await FETCHERS[loader]();
    cache.set(loader, { data, fetchedAt: now });
    return data;
  } catch (err) {
    if (entry) return { ...entry.data, stale: true };
    throw err instanceof Error ? err : new Error("version fetch failed");
  }
};

export const clearVersionCache = (): void => cache.clear();
