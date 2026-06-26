import type {
  PublicUser,
  Role,
  Server,
  PortAllocation,
  LoaderType,
  LoaderVersions,
  CreateServerPayload,
  ServerStatus,
  ServerProperties,
  PropertyField,
  FtpInfo,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
export const MOCK_API_ENABLED = process.env.NEXT_PUBLIC_MOCK_API === "1";

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; status: number }> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    const err = new ApiError(message, res.status);
    throw err;
  }

  const data = (await res.json()) as T;
  return { data, status: res.status };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const now = "2026-06-26T09:00:00.000Z";

const mockCurrentUser: PublicUser = {
  id: "user-admin",
  username: "admin",
  role: "admin",
  createdAt: now,
  updatedAt: now,
};

let mockUsers: PublicUser[] = [
  mockCurrentUser,
  {
    id: "user-operator",
    username: "operator",
    role: "operator",
    createdAt: "2026-06-20T11:30:00.000Z",
    updatedAt: "2026-06-24T08:10:00.000Z",
  },
  {
    id: "user-viewer",
    username: "viewer",
    role: "viewer",
    createdAt: "2026-06-18T14:45:00.000Z",
    updatedAt: "2026-06-18T14:45:00.000Z",
  },
];

let mockServers: Server[] = [
  {
    id: "srv-survival",
    name: "survival-main",
    loaderType: "VANILLA",
    mcVersion: "1.21.6",
    loaderVersion: null,
    javaTag: "java21",
    memoryMb: 4096,
    gamePort: 25565,
    rconPort: 25575,
    containerId: "mock-survival-main",
    eulaAccepted: true,
    statusCache: "running",
    liveStatus: "running",
    lastStartedAt: "2026-06-26T08:55:00.000Z",
    createdAt: "2026-06-21T10:20:00.000Z",
    updatedAt: now,
  },
  {
    id: "srv-modpack",
    name: "fabric-modpack",
    loaderType: "FABRIC",
    mcVersion: "1.21.5",
    loaderVersion: "0.16.14",
    javaTag: "java21",
    memoryMb: 6144,
    gamePort: 25566,
    rconPort: 25576,
    containerId: "mock-fabric-modpack",
    eulaAccepted: true,
    statusCache: "stopped",
    liveStatus: "stopped",
    lastStartedAt: "2026-06-25T17:20:00.000Z",
    createdAt: "2026-06-22T15:00:00.000Z",
    updatedAt: "2026-06-25T17:40:00.000Z",
  },
  {
    id: "srv-test",
    name: "forge-test",
    loaderType: "FORGE",
    mcVersion: "1.20.1",
    loaderVersion: "47.4.0",
    javaTag: "java17",
    memoryMb: 3072,
    gamePort: 25567,
    rconPort: 25577,
    containerId: "mock-forge-test",
    eulaAccepted: true,
    statusCache: "starting",
    liveStatus: "starting",
    lastStartedAt: now,
    createdAt: "2026-06-23T09:15:00.000Z",
    updatedAt: now,
  },
];

const mockLoaderVersions: Record<LoaderType, LoaderVersions> = {
  VANILLA: {
    loader: "VANILLA",
    mcVersions: ["1.21.6", "1.21.5", "1.21.4", "1.20.6", "1.20.1"],
  },
  FABRIC: {
    loader: "FABRIC",
    mcVersions: ["1.21.6", "1.21.5", "1.21.4", "1.20.6", "1.20.1"],
    loaderVersions: ["0.16.14", "0.16.13", "0.15.11"],
  },
  FORGE: {
    loader: "FORGE",
    mcVersions: ["1.21.5", "1.20.1", "1.19.4"],
    loaderVersionsByMc: {
      "1.21.5": ["55.0.22", "55.0.21"],
      "1.20.1": ["47.4.0", "47.3.12"],
      "1.19.4": ["45.3.12"],
    },
  },
  NEOFORGE: {
    loader: "NEOFORGE",
    mcVersions: ["1.21.6", "1.21.5", "1.20.6"],
    loaderVersionsByMc: {
      "1.21.6": ["21.6.20-beta", "21.6.12-beta"],
      "1.21.5": ["21.5.75", "21.5.72"],
      "1.20.6": ["20.6.125"],
    },
  },
};

const mockPropertyFields: PropertyField[] = [
  {
    key: "motd",
    label: "MOTD",
    type: "string",
    requiresRestart: false,
  },
  {
    key: "difficulty",
    label: "Difficulty",
    type: "enum",
    options: ["peaceful", "easy", "normal", "hard"],
    requiresRestart: false,
  },
  {
    key: "gamemode",
    label: "Game mode",
    type: "enum",
    options: ["survival", "creative", "adventure", "spectator"],
    requiresRestart: false,
  },
  {
    key: "max-players",
    label: "Max players",
    type: "int",
    min: 1,
    max: 100,
    requiresRestart: false,
  },
  {
    key: "view-distance",
    label: "View distance",
    type: "int",
    min: 2,
    max: 32,
    requiresRestart: true,
  },
  {
    key: "online-mode",
    label: "Online mode",
    type: "bool",
    requiresRestart: true,
  },
  {
    key: "pvp",
    label: "PvP",
    type: "bool",
    requiresRestart: false,
  },
];

let mockPropertyValues: Record<string, Record<string, string>> = {
  "srv-survival": {
    motd: "MC管理くん mock survival",
    difficulty: "normal",
    gamemode: "survival",
    "max-players": "20",
    "view-distance": "12",
    "online-mode": "true",
    pvp: "true",
  },
  "srv-modpack": {
    motd: "Fabric mods preview",
    difficulty: "hard",
    gamemode: "survival",
    "max-players": "12",
    "view-distance": "10",
    "online-mode": "true",
    pvp: "false",
  },
  "srv-test": {
    motd: "Forge test world",
    difficulty: "easy",
    gamemode: "creative",
    "max-players": "8",
    "view-distance": "8",
    "online-mode": "false",
    pvp: "false",
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(clone(value)), 180);
  });
}

function mockServerOrThrow(id: string): Server {
  const server = mockServers.find((s) => s.id === id);
  if (!server) throw new ApiError("Server not found", 404);
  return server;
}

function mockPorts(): PortAllocation[] {
  const serverPorts = mockServers.flatMap((server) => [
    {
      id: `${server.id}-game`,
      port: server.gamePort,
      protocol: "tcp" as const,
      purpose: "game" as const,
      serverId: server.id,
      note: `${server.name} game port`,
      createdAt: server.createdAt,
    },
    {
      id: `${server.id}-rcon`,
      port: server.rconPort,
      protocol: "tcp" as const,
      purpose: "rcon" as const,
      serverId: server.id,
      note: `${server.name} RCON`,
      createdAt: server.createdAt,
    },
  ]);

  return [
    ...serverPorts,
    {
      id: "ftp-main",
      port: 2121,
      protocol: "tcp",
      purpose: "ftp",
      serverId: null,
      note: "Mock FTP service",
      createdAt: "2026-06-19T12:00:00.000Z",
    },
  ];
}

function javaTagFor(mcVersion: string): string {
  const [major, minor] = mcVersion.split(".").map(Number);
  if (major > 1 || minor >= 20) return "java21";
  if (minor >= 18) return "java17";
  return "java8";
}

// Auth
export async function getMe(): Promise<PublicUser> {
  if (MOCK_API_ENABLED) return mockDelay(mockCurrentUser);
  const { data } = await apiFetch<{ user: PublicUser }>("/api/auth/me");
  return data.user;
}

export async function login(
  username: string,
  password: string
): Promise<PublicUser> {
  if (MOCK_API_ENABLED) return mockDelay(mockCurrentUser);
  const { data } = await apiFetch<{ user: PublicUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  if (MOCK_API_ENABLED) return mockDelay(undefined);
  await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

// Users
export async function listUsers(): Promise<PublicUser[]> {
  if (MOCK_API_ENABLED) return mockDelay(mockUsers);
  const { data } = await apiFetch<{ users: PublicUser[] }>("/api/users");
  return data.users;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: Role;
}): Promise<PublicUser> {
  if (MOCK_API_ENABLED) {
    if (mockUsers.some((u) => u.username === payload.username)) {
      throw new ApiError("Username already exists", 409);
    }
    const user: PublicUser = {
      id: `user-${Date.now()}`,
      username: payload.username,
      role: payload.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockUsers = [...mockUsers, user];
    return mockDelay(user);
  }
  const { data } = await apiFetch<{ user: PublicUser }>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function updateUser(
  id: string,
  payload: { role?: Role; password?: string }
): Promise<PublicUser> {
  if (MOCK_API_ENABLED) {
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw new ApiError("User not found", 404);
    const updated: PublicUser = {
      ...user,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    mockUsers = mockUsers.map((u) => (u.id === id ? updated : u));
    return mockDelay(updated);
  }
  const { data } = await apiFetch<{ user: PublicUser }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function deleteUser(id: string): Promise<void> {
  if (MOCK_API_ENABLED) {
    mockUsers = mockUsers.filter((u) => u.id !== id);
    return mockDelay(undefined);
  }
  await apiFetch<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" });
}

// Servers
export async function getLoaders(): Promise<LoaderType[]> {
  if (MOCK_API_ENABLED) return mockDelay(["VANILLA", "FORGE", "NEOFORGE", "FABRIC"]);
  const { data } = await apiFetch<{ loaders: LoaderType[] }>("/api/meta/loaders");
  return data.loaders;
}

export async function getLoaderVersions(loader: LoaderType): Promise<LoaderVersions> {
  if (MOCK_API_ENABLED) return mockDelay(mockLoaderVersions[loader]);
  const { data } = await apiFetch<LoaderVersions>(`/api/meta/versions/${loader}`);
  return data;
}

export async function getJavaTag(
  mcVersion: string,
  loader: LoaderType
): Promise<string> {
  if (MOCK_API_ENABLED) return mockDelay(javaTagFor(mcVersion));
  const params = new URLSearchParams({ mcVersion, loader });
  const { data } = await apiFetch<{ javaTag: string }>(
    `/api/meta/java-tag?${params.toString()}`
  );
  return data.javaTag;
}

export async function listServers(): Promise<Server[]> {
  if (MOCK_API_ENABLED) return mockDelay(mockServers);
  const { data } = await apiFetch<{ servers: Server[] }>("/api/servers");
  return data.servers;
}

export async function createServer(
  payload: CreateServerPayload
): Promise<{ server: Server; status: number }> {
  if (MOCK_API_ENABLED) {
    const server: Server = {
      id: `srv-${Date.now()}`,
      name: payload.name,
      loaderType: payload.loaderType,
      mcVersion: payload.mcVersion,
      loaderVersion: payload.loaderVersion,
      javaTag: javaTagFor(payload.mcVersion),
      memoryMb: payload.memoryMb,
      gamePort: payload.gamePort,
      rconPort: payload.rconPort,
      containerId: `mock-${payload.name}`,
      eulaAccepted: payload.eulaAccepted,
      statusCache: "stopped",
      liveStatus: "stopped",
      lastStartedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockServers = [server, ...mockServers];
    mockPropertyValues[server.id] = clone(mockPropertyValues["srv-survival"]);
    return mockDelay({ server, status: 201 });
  }
  const { data, status } = await apiFetch<{ server: Server }>("/api/servers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { server: data.server, status };
}

export async function controlServer(
  id: string,
  action: "start" | "stop" | "restart"
): Promise<ServerStatus> {
  if (MOCK_API_ENABLED) {
    const server = mockServerOrThrow(id);
    const nextStatus: ServerStatus = action === "stop" ? "stopped" : "running";
    const updatedAt = new Date().toISOString();
    mockServers = mockServers.map((s) =>
      s.id === id
        ? {
            ...s,
            statusCache: nextStatus,
            liveStatus: nextStatus,
            lastStartedAt: action === "stop" ? s.lastStartedAt : updatedAt,
            updatedAt,
          }
        : s
    );
    return mockDelay(server.liveStatus === nextStatus ? server.liveStatus : nextStatus);
  }
  const { data } = await apiFetch<{ ok: boolean; status: ServerStatus }>(
    `/api/servers/${id}/${action}`,
    { method: "POST" }
  );
  return data.status;
}

export async function deleteServer(id: string): Promise<void> {
  if (MOCK_API_ENABLED) {
    mockServerOrThrow(id);
    mockServers = mockServers.filter((s) => s.id !== id);
    delete mockPropertyValues[id];
    return mockDelay(undefined);
  }
  await apiFetch<{ ok: boolean }>(`/api/servers/${id}`, { method: "DELETE" });
}

export async function listPorts(): Promise<PortAllocation[]> {
  if (MOCK_API_ENABLED) return mockDelay(mockPorts());
  const { data } = await apiFetch<{ allocations: PortAllocation[] }>("/api/ports");
  return data.allocations;
}

export async function getServer(id: string): Promise<Server> {
  if (MOCK_API_ENABLED) return mockDelay(mockServerOrThrow(id));
  const { data } = await apiFetch<{ server: Server }>(`/api/servers/${id}`);
  return data.server;
}

export async function sendConsoleCommand(
  id: string,
  command: string
): Promise<string> {
  if (MOCK_API_ENABLED) {
    mockServerOrThrow(id);
    return mockDelay(`[mock] Executed: ${command}`);
  }
  const { data } = await apiFetch<{ response: string }>(
    `/api/servers/${id}/console`,
    {
      method: "POST",
      body: JSON.stringify({ command }),
    }
  );
  return data.response;
}

export const WS_BASE = API_BASE.replace(/^http/, "ws");

// Server properties (server.properties GUI)
export async function getServerProperties(id: string): Promise<ServerProperties> {
  if (MOCK_API_ENABLED) {
    mockServerOrThrow(id);
    return mockDelay({
      fields: mockPropertyFields,
      values: mockPropertyValues[id] ?? mockPropertyValues["srv-survival"],
    });
  }
  const { data } = await apiFetch<ServerProperties>(
    `/api/servers/${id}/properties`
  );
  return data;
}

export async function saveServerProperties(
  id: string,
  updates: Record<string, string | number | boolean>
): Promise<{ updated: Record<string, string>; requiresRestart: string[] }> {
  if (MOCK_API_ENABLED) {
    mockServerOrThrow(id);
    const nextValues = {
      ...(mockPropertyValues[id] ?? mockPropertyValues["srv-survival"]),
    };
    for (const [key, value] of Object.entries(updates)) {
      nextValues[key] = String(value);
    }
    mockPropertyValues = { ...mockPropertyValues, [id]: nextValues };
    const requiresRestart = mockPropertyFields
      .filter((field) => field.requiresRestart && field.key in updates)
      .map((field) => field.key);
    return mockDelay({ updated: nextValues, requiresRestart });
  }
  const { data } = await apiFetch<{
    updated: Record<string, string>;
    requiresRestart: string[];
  }>(`/api/servers/${id}/properties`, {
    method: "PUT",
    body: JSON.stringify({ updates }),
  });
  return data;
}

// FTP
export async function getFtpInfo(): Promise<FtpInfo> {
  if (MOCK_API_ENABLED) {
    return mockDelay({
      host: "192.168.1.20",
      port: 2121,
      user: "minecraft",
      modsPathTemplate: "/srv/minecraft/{serverName}/mods",
    });
  }
  const { data } = await apiFetch<{ ftp: FtpInfo }>("/api/ftp");
  return data.ftp;
}

export async function getServerFtp(id: string): Promise<{ modsPath: string }> {
  if (MOCK_API_ENABLED) {
    const server = mockServerOrThrow(id);
    return mockDelay({ modsPath: `/srv/minecraft/${server.name}/mods` });
  }
  const { data } = await apiFetch<{ modsPath: string }>(`/api/servers/${id}/ftp`);
  return data;
}

// Update server (name / memoryMb)
export async function updateServer(
  id: string,
  patch: { name?: string; memoryMb?: number }
): Promise<Server> {
  if (MOCK_API_ENABLED) {
    const server = mockServerOrThrow(id);
    const updated: Server = {
      ...server,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    mockServers = mockServers.map((s) => (s.id === id ? updated : s));
    return mockDelay(updated);
  }
  const { data } = await apiFetch<{ server: Server }>(`/api/servers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.server;
}
