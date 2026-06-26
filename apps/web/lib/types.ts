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
  | "stopping"
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
  /** 最後に起動した時刻(ISO 文字列)。未起動なら null。 */
  lastStartedAt: string | null;
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

// FTP
export interface FtpInfo {
  host: string;
  port: number;
  user: string;
  modsPathTemplate: string;
}

// server.properties GUI
export interface PropertyField {
  key: string;
  label: string;
  type: "bool" | "int" | "enum" | "string";
  options?: string[];
  min?: number;
  max?: number;
  requiresRestart: boolean;
}

export interface ServerProperties {
  fields: PropertyField[];
  values: Record<string, string>;
}
