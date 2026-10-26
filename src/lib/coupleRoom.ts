import { newId } from "./id.ts";
import type { DataConnection, Peer as PeerType } from "peerjs";
import {
  buildSyncPayload,
  applySyncPayload,
  parseSyncPayload,
  peerIdForRoom,
  type CoupleRoomMeta,
  type SyncPayload,
} from "./coupleSync.ts";
import type { AppState } from "../types.ts";

const CLOUD_BASE = "https://extendsclass.com/api/json-storage/bin";

export type CoupleStatus = {
  connected: boolean;
  peerReady: boolean;
  cloudOk: boolean;
  message: string;
};

type Handlers = {
  onRemote: (payload: SyncPayload) => boolean;
  onSent?: (id: string) => void;
  onAcknowledged?: (id: string) => void;
  onStatus: (status: CoupleStatus) => void;
};

let peer: PeerType | null = null;
let conn: DataConnection | null = null;
let handlers: Handlers | null = null;
let generation = 0;
function setStatus(partial: Partial<CoupleStatus> & { message: string }): void {
  handlers?.onStatus({
    connected: Boolean(conn?.open),
    peerReady: Boolean(peer && !peer.destroyed),
    cloudOk: partial.cloudOk ?? false,
    ...partial,
  });
}

const requests = new Set<AbortController>();
export function cancelSyncRequests(): void {
  for (const request of requests) request.abort();
  requests.clear();
}
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    requests.delete(controller);
  }
}
const roomUrl = (code: string) => `/api/rooms/${encodeURIComponent(code)}`;
export async function cloudGet(binId: string): Promise<SyncPayload | null> {
  try {
    const res = await request(
      `${CLOUD_BASE}/${encodeURIComponent(binId)}?t=${Date.now()}`,
    );
    return res.ok ? parseSyncPayload(await res.json()) : null;
  } catch {
    return null;
  }
}

function wireConnection(connection: DataConnection): void {
  if (conn && conn !== connection) {
    connection.close();
    return;
  }
  const sessionGeneration = generation;
  conn = connection;
  connection.on("open", () => {
    if (generation !== sessionGeneration) return;
    setStatus({ connected: true, message: "对方已连上，可以一起改菜单了" });
  });
  connection.on("data", (data) => {
    if (generation !== sessionGeneration) return;
    if (
      data &&
      typeof data === "object" &&
      (data as { kind?: string }).kind === "ack"
    ) {
      const id = (data as { id?: unknown }).id;
      if (typeof id === "string" && pendingMessages.has(id)) {
        pendingMessages.delete(id);
        handlers?.onAcknowledged?.(id);
      }
      return;
    }
    const message = data as { kind?: string; id?: string; payload?: unknown };
    const payload = parseSyncPayload(
      message?.kind === "state" ? message.payload : data,
    );
    if (
      payload &&
      handlers?.onRemote(payload) &&
      message.kind === "state" &&
      typeof message.id === "string" &&
      message.id.length <= 100
    )
      connection.send({ kind: "ack", id: message.id });
  });
  connection.on("close", () => {
    if (generation !== sessionGeneration) return;
    conn = null;
    setStatus({ connected: false, message: "连线断开了，可重试或用同步包" });
  });
  connection.on("error", () => {
    if (generation !== sessionGeneration) return;
    setStatus({ connected: false, message: "连线出了问题，可重试或用同步包" });
  });
}

export function disconnectCouple(): void {
  generation += 1;
  pendingMessages.clear();
  handlers = null;
  try {
    conn?.close();
  } catch {
    /* ignore */
  }
  conn = null;
  try {
    peer?.destroy();
  } catch {
    /* ignore */
  }
  peer = null;
}

export async function startCoupleSession(
  meta: CoupleRoomMeta,
  getState: () => AppState,
  nextHandlers: Handlers,
): Promise<void> {
  disconnectCouple();
  const sessionGeneration = generation;
  handlers = nextHandlers;
  const peerId = peerIdForRoom(meta.code);
  setStatus({
    connected: false,
    peerReady: false,
    cloudOk: false,
    message: "正在连线…",
  });

  const { Peer } = await import("peerjs");
  if (sessionGeneration !== generation) return;
  const instance =
    meta.role === "host"
      ? new Peer(peerId, { debug: 0 })
      : new Peer({ debug: 0 });
  peer = instance;
  window.setTimeout(() => {
    if (generation !== sessionGeneration || conn?.open) return;
    setStatus({
      connected: false,
      message: "对方尚未连上，云端保存不代表已送达；可重试或用同步包",
    });
  }, 8000);

  instance.on("open", () => {
    if (generation !== sessionGeneration) return;
    setStatus({
      peerReady: true,
      message: meta.role === "host" ? "房间已开，等对方加入" : "正在找房间…",
    });
    if (meta.role === "guest") {
      const connection = instance.connect(peerId, { reliable: true });
      wireConnection(connection);
    }
  });

  instance.on("connection", (connection) => {
    if (generation !== sessionGeneration) {
      connection.close();
      return;
    }
    wireConnection(connection);
    const payload = buildSyncPayload(getState());
    window.setTimeout(() => {
      if (connection.open) sendPayload(payload);
    }, 200);
  });

  instance.on("error", (err) => {
    if (generation !== sessionGeneration) return;
    const msg = String(
      (err as { type?: string; message?: string })?.type ??
        (err as Error)?.message ??
        err,
    );
    if (
      msg.includes("unavailable-id") ||
      msg.includes("ID is taken") ||
      msg.includes("taken")
    ) {
      setStatus({
        peerReady: false,
        message: "房间号被占用，换一个或直接加入",
      });
    } else {
      setStatus({ peerReady: false, message: "连线失败，可重试或用同步包" });
    }
  });
}

const pendingMessages = new Set<string>();
function sendPayload(payload: SyncPayload): boolean {
  if (!conn?.open) return false;
  const id = newId();
  if (pendingMessages.size > 50) pendingMessages.clear();
  pendingMessages.add(id);
  handlers?.onSent?.(id);
  conn.send({ kind: "state", id, payload });
  return true;
}
export function pushToPeer(state: AppState): boolean {
  return sendPayload(buildSyncPayload(state));
}

type CloudResult = {
  meta: CoupleRoomMeta;
  ok: boolean;
  message: string;
  payload?: SyncPayload;
};
export async function pushToCloud(
  meta: CoupleRoomMeta,
  state: AppState,
): Promise<CloudResult> {
  if (meta.cloudBinId && meta.cloudProtocol !== 2)
    return {
      meta: { ...meta, lastError: "旧版备份保持只读，请创建新版房间" },
      ok: false,
      message: "旧版云备份只读，实时连线和同步包仍可用",
    };
  try {
    let candidate = state;
    if (meta.cloudProtocol !== 2) {
      const res = await request("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSyncPayload(candidate)),
      });
      if (!res.ok) throw new Error("当前托管未启用版本同步服务");
      const data = (await res.json()) as {
        code: string;
        revision: number;
        payload: unknown;
      };
      return {
        meta: {
          ...meta,
          code: data.code,
          cloudProtocol: 2,
          cloudRevision: data.revision,
          lastCloudSavedAt: Date.now(),
          lastError: undefined,
        },
        ok: true,
        message: "版本房间已创建",
        payload: parseSyncPayload(data.payload) ?? undefined,
      };
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const read = await request(roomUrl(meta.code));
      if (!read.ok) throw new Error("云端读取失败，未覆盖原数据");
      const data = (await read.json()) as {
        revision: number;
        payload: unknown;
      };
      const remote = parseSyncPayload(data.payload);
      if (!remote || !Number.isSafeInteger(data.revision))
        throw new Error("云端数据无效，未写入");
      candidate = applySyncPayload(candidate, remote);
      const payload = buildSyncPayload(candidate);
      if (JSON.stringify(payload.sync) === JSON.stringify(remote.sync))
        return {
          meta: {
            ...meta,
            cloudRevision: data.revision,
            lastCloudSavedAt: Date.now(),
            lastError: undefined,
          },
          ok: true,
          message: "云端已保存当前修订",
          payload,
        };
      const write = await request(roomUrl(meta.code), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(data.revision),
        },
        body: JSON.stringify(payload),
      });
      if (write.status === 409) continue;
      if (!write.ok) throw new Error("云端写入失败");
      const saved = (await write.json()) as { revision: number };
      return {
        meta: {
          ...meta,
          cloudRevision: saved.revision,
          lastCloudSavedAt: Date.now(),
          lastError: undefined,
        },
        ok: true,
        message: "云端已保存当前修订",
        payload,
      };
    }
    throw new Error("对方仍在修改，稍后重试；本机改动已保存");
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "同步已取消或超时，请重试"
        : error instanceof Error
          ? error.message
          : "同步失败";
    return { meta: { ...meta, lastError: message }, ok: false, message };
  }
}
export async function pullFromCloud(
  meta: CoupleRoomMeta,
): Promise<SyncPayload | null> {
  if (meta.cloudProtocol === 2) {
    try {
      const res = await request(roomUrl(meta.code));
      if (!res.ok) return null;
      const data = (await res.json()) as { payload: unknown };
      return parseSyncPayload(data.payload);
    } catch {
      return null;
    }
  }
  return meta.cloudBinId ? cloudGet(meta.cloudBinId) : null;
}
export async function findVersionedRoom(
  code: string,
): Promise<{ meta: CoupleRoomMeta; payload: SyncPayload } | null> {
  try {
    const res = await request(roomUrl(code));
    if (!res.ok) return null;
    const data = (await res.json()) as { revision: number; payload: unknown };
    const payload = parseSyncPayload(data.payload);
    return payload
      ? {
          meta: {
            code,
            role: "guest",
            cloudProtocol: 2,
            cloudRevision: data.revision,
          },
          payload,
        }
      : null;
  } catch {
    return null;
  }
}
