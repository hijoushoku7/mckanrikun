export type Role = "admin" | "operator" | "viewer";

export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

// Minecraft server types
export type LoaderType = "VANILLA" | "FORGE" | "NEOFORGE" | "FABRIC";

export type ServerStatus =
  | "running"
  | "stopped"
  | "starting"
  | "error"
  | "unknown";

export interface Server {
  id: string;
  name: string;
  loaderType: LoaderType;
  mcVersion: string;
  loaderVersion: string | null;
  javaTag: string;
  memoryMb: number;
  gamePort: number;
  rconPort: number;
  containerId: string | null;
  eulaAccepted: boolean;
  statusCache: ServerStatus;
  createdAt: string;
  updatedAt: string;
  liveStatus: ServerStatus;
}

export interface PortAllocation {
  id: string;
  port: number;
  protocol: "tcp" | "udp";
  purpose: "game" | "rcon" | "ftp" | "other";
  serverId: string | null;
  note: string | null;
  createdAt: string;
}

export interface LoaderVersions {
  loader: LoaderType;
  mcVersions: string[];
  /** FABRIC: MC非依存のローダーバージョン一覧 */
  loaderVersions?: string[];
  /** FORGE / NEOFORGE: MCバージョンごとのローダーバージョン */
  loaderVersionsByMc?: Record<string, string[]>;
  stale?: boolean;
}

export interface CreateServerPayload {
  name: string;
  loaderType: LoaderType;
  mcVersion: string;
  loaderVersion: string | null;
  memoryMb: number;
  gamePort: number;
  rconPort: number;
  eulaAccepted: true;
}
