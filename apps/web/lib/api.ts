import type {
  PublicUser,
  Role,
  Server,
  PortAllocation,
  LoaderType,
  LoaderVersions,
  CreateServerPayload,
  ServerStatus,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

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

// Auth
export async function getMe(): Promise<PublicUser> {
  const { data } = await apiFetch<{ user: PublicUser }>("/api/auth/me");
  return data.user;
}

export async function login(
  username: string,
  password: string
): Promise<PublicUser> {
  const { data } = await apiFetch<{ user: PublicUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

// Users
export async function listUsers(): Promise<PublicUser[]> {
  const { data } = await apiFetch<{ users: PublicUser[] }>("/api/users");
  return data.users;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: Role;
}): Promise<PublicUser> {
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
  const { data } = await apiFetch<{ user: PublicUser }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" });
}

// Servers
export async function getLoaders(): Promise<LoaderType[]> {
  const { data } = await apiFetch<{ loaders: LoaderType[] }>("/api/meta/loaders");
  return data.loaders;
}

export async function getLoaderVersions(loader: LoaderType): Promise<LoaderVersions> {
  const { data } = await apiFetch<LoaderVersions>(`/api/meta/versions/${loader}`);
  return data;
}

export async function getJavaTag(
  mcVersion: string,
  loader: LoaderType
): Promise<string> {
  const params = new URLSearchParams({ mcVersion, loader });
  const { data } = await apiFetch<{ javaTag: string }>(
    `/api/meta/java-tag?${params.toString()}`
  );
  return data.javaTag;
}

export async function listServers(): Promise<Server[]> {
  const { data } = await apiFetch<{ servers: Server[] }>("/api/servers");
  return data.servers;
}

export async function createServer(
  payload: CreateServerPayload
): Promise<{ server: Server; status: number }> {
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
  const { data } = await apiFetch<{ ok: boolean; status: ServerStatus }>(
    `/api/servers/${id}/${action}`,
    { method: "POST" }
  );
  return data.status;
}

export async function deleteServer(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/servers/${id}`, { method: "DELETE" });
}

export async function listPorts(): Promise<PortAllocation[]> {
  const { data } = await apiFetch<{ allocations: PortAllocation[] }>("/api/ports");
  return data.allocations;
}
