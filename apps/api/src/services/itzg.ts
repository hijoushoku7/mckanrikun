import { resolve } from "node:path";
import { config } from "../config.ts";
import type { Server } from "../db/schema.ts";
import { buildManagedLabels } from "../docker/labels.ts";
import type { CreateContainerSpec } from "../docker/service.ts";

type LoaderType = Server["loaderType"];

/** ローダー種別 → itzg がローダーバージョンを受け取る環境変数名。 */
const LOADER_VERSION_ENV: Record<LoaderType, string | null> = {
  VANILLA: null,
  FORGE: "FORGE_VERSION",
  NEOFORGE: "NEOFORGE_VERSION",
  FABRIC: "FABRIC_LOADER_VERSION",
};

/** JVM の非ヒープ領域(metaspace/スレッド/オフヒープ)用に確保するメモリ(MB)。 */
const JVM_NONHEAP_RESERVE_MB = 512;
const MIN_HEAP_MB = 512;
const MB = 1024 * 1024;

export interface ItzgServerInput {
  id: string;
  name: string;
  loaderType: LoaderType;
  mcVersion: string;
  loaderVersion: string | null;
  javaTag: string;
  memoryMb: number;
  gamePort: number;
  rconPort: number;
  rconPassword: string;
}

/** itzg コンテナへ渡す環境変数(["KEY=VALUE", ...])を組み立てる。 */
export const buildItzgEnv = (input: ItzgServerInput): string[] => {
  // コンテナのメモリ上限(= ユーザー指定)を超えないよう、JVM 最大ヒープは
  // 非ヒープ予約分を差し引いた値にする(OOM Kill 回避)。
  const maxHeapMb = Math.max(input.memoryMb - JVM_NONHEAP_RESERVE_MB, MIN_HEAP_MB);

  const env: string[] = [
    "EULA=TRUE",
    `TYPE=${input.loaderType}`,
    `VERSION=${input.mcVersion}`,
    `MEMORY=${maxHeapMb}M`,
    "ENABLE_RCON=true",
    `RCON_PASSWORD=${input.rconPassword}`,
    `RCON_PORT=${config.containerRconPort}`,
    `SERVER_PORT=${config.containerGamePort}`,
  ];

  const versionEnv = LOADER_VERSION_ENV[input.loaderType];
  if (versionEnv && input.loaderVersion) {
    env.push(`${versionEnv}=${input.loaderVersion}`);
  }
  return env;
};

/** itzg コンテナ生成用の汎用スペックを組み立てる。 */
export const buildItzgSpec = (input: ItzgServerInput): CreateContainerSpec => {
  const dataDir = resolve(process.cwd(), config.serverDataRoot, input.id);
  return {
    image: `itzg/minecraft-server:${input.javaTag}`,
    name: `mc-${input.id}`,
    labels: buildManagedLabels(input.id, input.name),
    env: buildItzgEnv(input),
    ports: [
      {
        containerPort: config.containerGamePort,
        hostPort: input.gamePort,
        protocol: "tcp",
      },
      {
        containerPort: config.containerRconPort,
        hostPort: input.rconPort,
        protocol: "tcp",
      },
    ],
    binds: [`${dataDir}:/data`],
    // コンテナのハード上限はユーザー指定値そのもの。
    memoryBytes: input.memoryMb * MB,
    restartPolicy: "unless-stopped",
  };
};
