import type Docker from "dockerode";
import { docker } from "./client.ts";
import { managedFilter, serverIdFromLabels } from "./labels.ts";
import { normalizeStatus, type ServerStatus } from "./status.ts";

export interface PortBinding {
  containerPort: number;
  hostPort: number;
  protocol: "tcp" | "udp";
}

/**
 * コンテナ生成の汎用スペック。itzg 固有のマッピング(TYPE/VERSION/EULA 等)は
 * Phase 3 の作成ウィザードで env を組み立ててここへ渡す。
 */
export interface CreateContainerSpec {
  image: string;
  /** コンテナ名(docker 上の name)。一意であること。 */
  name: string;
  labels: Record<string, string>;
  /** 環境変数 ["KEY=VALUE", ...]。 */
  env: string[];
  ports: PortBinding[];
  /** ボリュームバインド ["/host/path:/container/path", ...]。 */
  binds?: string[];
  /** メモリ上限(バイト)。0/未指定で無制限。 */
  memoryBytes?: number;
  restartPolicy?: "no" | "unless-stopped" | "always";
}

/** 管理対象コンテナの一覧表示用サマリ。 */
export interface ManagedContainerInfo {
  containerId: string;
  serverId: string | null;
  name: string;
  image: string;
  state: string;
  status: ServerStatus;
}

/** Docker イベント(コンテナ状態変化)の最小表現。 */
export interface ContainerEvent {
  action: string;
  containerId: string;
  serverId: string | null;
}

/**
 * Docker Engine API のラッパー。コンテナのライフサイクル操作・識別・状態取得・
 * イベント購読を提供する(要件 §9 Phase 2)。
 */
export class DockerService {
  constructor(private readonly client: Docker = docker) {}

  /** デーモン疎通確認。 */
  async ping(): Promise<void> {
    await this.client.ping();
  }

  /** スペックからコンテナを生成し container id を返す(起動はしない)。 */
  async create(spec: CreateContainerSpec): Promise<string> {
    const exposedPorts: Record<string, Record<string, never>> = {};
    const portBindings: Record<
      string,
      Array<{ HostPort: string }>
    > = {};
    for (const p of spec.ports) {
      const key = `${p.containerPort}/${p.protocol}`;
      exposedPorts[key] = {};
      portBindings[key] = [{ HostPort: String(p.hostPort) }];
    }

    const container = await this.client.createContainer({
      Image: spec.image,
      name: spec.name,
      Labels: spec.labels,
      Env: spec.env,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: spec.binds ?? [],
        Memory: spec.memoryBytes && spec.memoryBytes > 0 ? spec.memoryBytes : 0,
        RestartPolicy: { Name: spec.restartPolicy ?? "unless-stopped" },
      },
    });
    return container.id;
  }

  /** イメージを pull する(itzg タグの初回取得など)。完了まで待機。 */
  async pullImage(image: string): Promise<void> {
    const stream = await this.client.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.client.modem.followProgress(stream, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }

  async start(containerId: string): Promise<void> {
    await this.client.getContainer(containerId).start();
  }

  /** 停止。timeoutSec 経過後に SIGKILL。 */
  async stop(containerId: string, timeoutSec = 30): Promise<void> {
    await this.client.getContainer(containerId).stop({ t: timeoutSec });
  }

  async restart(containerId: string, timeoutSec = 30): Promise<void> {
    await this.client.getContainer(containerId).restart({ t: timeoutSec });
  }

  /** 削除。force=true で起動中でも削除、removeVolumes でボリュームも削除。 */
  async remove(
    containerId: string,
    opts: { force?: boolean; removeVolumes?: boolean } = {},
  ): Promise<void> {
    await this.client
      .getContainer(containerId)
      .remove({ force: opts.force ?? false, v: opts.removeVolumes ?? false });
  }

  /** 単一コンテナの正規化済みステータスを取得。存在しなければ unknown。 */
  async getStatus(containerId: string): Promise<ServerStatus> {
    try {
      const info = await this.client.getContainer(containerId).inspect();
      return normalizeStatus(
        info.State?.Status,
        info.State?.Health?.Status,
        info.State?.ExitCode,
      );
    } catch {
      return "unknown";
    }
  }

  /** 管理ラベルを持つコンテナを一覧。停止中も含む(all: true)。 */
  async listManaged(): Promise<ManagedContainerInfo[]> {
    const containers = await this.client.listContainers({
      all: true,
      filters: managedFilter,
    });
    return containers.map((c) => ({
      containerId: c.Id,
      serverId: serverIdFromLabels(c.Labels),
      name: c.Names?.[0]?.replace(/^\//, "") ?? "",
      image: c.Image,
      state: c.State,
      status: normalizeStatus(c.State, undefined, undefined),
    }));
  }

  /**
   * 管理対象コンテナのイベントを購読する。返り値の関数で購読解除。
   * 再接続は呼び出し側の責務(本実装は単発ストリーム)。
   */
  async subscribeEvents(
    onEvent: (ev: ContainerEvent) => void,
  ): Promise<() => void> {
    const stream = await this.client.getEvents({
      filters: { type: ["container"], label: [`${"mc-manager.managed"}=true`] },
    });

    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const ev = JSON.parse(trimmed) as {
            Action?: string;
            id?: string;
            Actor?: { Attributes?: Record<string, string> };
          };
          onEvent({
            action: ev.Action ?? "",
            containerId: ev.id ?? "",
            serverId: serverIdFromLabels(ev.Actor?.Attributes),
          });
        } catch {
          // 不完全な JSON 行は無視(チャンク境界で分割される場合がある)。
        }
      }
    };

    stream.on("data", onData);
    return () => {
      stream.removeListener("data", onData);
      // dockerode のイベントストリームは destroy で停止。
      (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    };
  }
}

export const dockerService = new DockerService();
