import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { portAllocations, type PortAllocation } from "../db/schema.ts";

export type Protocol = PortAllocation["protocol"];
export type Purpose = PortAllocation["purpose"];

export interface PortRequest {
  port: number;
  protocol: Protocol;
  purpose: Purpose;
}

export const listAllocations = (): PortAllocation[] =>
  db.select().from(portAllocations).all();

/** 指定 (port, protocol) が既に確保済みか。 */
export const isPortTaken = (port: number, protocol: Protocol): boolean =>
  db
    .select()
    .from(portAllocations)
    .all()
    .some((a) => a.port === port && a.protocol === protocol);

/**
 * 要求ポート群のうち、既存と衝突するものを返す(空なら全て利用可)。
 * リクエスト内での重複も衝突として検出する。
 */
export const findPortConflicts = (requests: PortRequest[]): number[] => {
  const conflicts = new Set<number>();
  const seen = new Set<string>();
  for (const r of requests) {
    const key = `${r.port}/${r.protocol}`;
    if (seen.has(key) || isPortTaken(r.port, r.protocol)) {
      conflicts.add(r.port);
    }
    seen.add(key);
  }
  return [...conflicts];
};

/** ポートをサーバーに紐付けて確保(記録)する。 */
export const allocatePorts = (
  serverId: string | null,
  requests: PortRequest[],
  note?: string,
): void => {
  for (const r of requests) {
    db.insert(portAllocations)
      .values({
        port: r.port,
        protocol: r.protocol,
        purpose: r.purpose,
        serverId,
        note: note ?? null,
      })
      .run();
  }
};

/** サーバーに紐付くポート確保を全て解放する。 */
export const releasePortsForServer = (serverId: string): void => {
  db.delete(portAllocations).where(eq(portAllocations.serverId, serverId)).run();
};

export const isValidPort = (p: unknown): p is number =>
  typeof p === "number" && Number.isInteger(p) && p >= 1024 && p <= 65535;
