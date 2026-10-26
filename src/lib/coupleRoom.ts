import type { DataConnection, Peer as PeerType } from "peerjs";
import {
  buildSyncPayload,
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
  onRemote: (payload: SyncPayload) => void;
  onStatus: (status: CoupleStatus) => void;
};

let peer: PeerType | null = null;
let conn: DataConnection | null = null;
let handlers: Handlers | null = null;
function setStatus(partial: Partial<CoupleStatus> & { message: string }): void {
  handlers?.onStatus({
    connected: Boolean(conn?.open),
    peerReady: Boolean(peer && !peer.destroyed),
    cloudOk: partial.cloudOk ?? false,
    ...partial,
  });
}

async function cloudCreate(payload: SyncPayload): Promise<string | null> {
  try {
    const res = await fetch(CLOUD_BASE, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ ...payload, app: "jte" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

async function cloudPut(binId: string, payload: SyncPayload): Promise<boolean> {
  try {
    const res = await fetch(`${CLOUD_BASE}/${encodeURIComponent(binId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, app: "jte" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function cloudGet(binId: string): Promise<SyncPayload | null> {
  try {
    const res = await fetch(`${CLOUD_BASE}/${encodeURIComponent(binId)}?t=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseSyncPayload(data);
  } catch {
    return null;
  }
}

function wireConnection(connection: DataConnection): void {
  conn = connection;
  connection.on("open", () => {
    setStatus({ connected: true, message: "对方已连上，可以一起改菜单了" });
  });
  connection.on("data", (data) => {
    const payload = parseSyncPayload(data);
    if (payload) handlers?.onRemote(payload);
  });
  connection.on("close", () => {
    conn = null;
    setStatus({ connected: false, message: "连线断开了，可重试或用同步包" });
  });
  connection.on("error", () => {
    setStatus({ connected: false, message: "连线出了问题，可重试或用同步包" });
  });
}

export function disconnectCouple(): void {
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
  handlers = nextHandlers;
  const peerId = peerIdForRoom(meta.code);
  setStatus({ connected: false, peerReady: false, cloudOk: false, message: "正在连线…" });

  const { Peer } = await import("peerjs");
  const instance =
    meta.role === "host" ? new Peer(peerId, { debug: 0 }) : new Peer({ debug: 0 });
  peer = instance;

  instance.on("open", () => {
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
    wireConnection(connection);
    const payload = buildSyncPayload(getState());
    window.setTimeout(() => {
      if (connection.open) connection.send(payload);
    }, 200);
  });

  instance.on("error", (err) => {
    const msg = String((err as { type?: string; message?: string })?.type ?? (err as Error)?.message ?? err);
    if (msg.includes("unavailable-id") || msg.includes("ID is taken") || msg.includes("taken")) {
      setStatus({ peerReady: false, message: "房间号被占用，换一个或直接加入" });
    } else {
      setStatus({ peerReady: false, message: "连线失败，可重试或用同步包" });
    }
  });
}

export function pushToPeer(state: AppState): boolean {
  const payload = buildSyncPayload(state);
  if (conn?.open) {
    conn.send(payload);
    return true;
  }
  return false;
}

export async function pushToCloud(
  meta: CoupleRoomMeta,
  state: AppState,
): Promise<{ meta: CoupleRoomMeta; ok: boolean; message: string }> {
  const payload = buildSyncPayload(state);

  if (meta.cloudBinId) {
    const updated = await cloudPut(meta.cloudBinId, payload);
    if (updated) {
      return {
        meta: { ...meta, lastSyncedAt: Date.now(), lastError: undefined },
        ok: true,
        message: "已写入云端备份",
      };
    }
  }

  const created = await cloudCreate(payload);
  if (created) {
    return {
      meta: {
        ...meta,
        cloudBinId: created,
        lastSyncedAt: Date.now(),
        lastError: undefined,
      },
      ok: true,
      message: meta.cloudBinId
        ? "云端柜换了新号（已记在本机），实时仍靠房间连线或同步包"
        : "已建立云端备份",
    };
  }

  return {
    meta: { ...meta, lastError: "云端暂时写不进去" },
    ok: false,
    message: "云端写失败了，请用同步包发给对方",
  };
}

export async function pullFromCloud(meta: CoupleRoomMeta): Promise<SyncPayload | null> {
  if (!meta.cloudBinId) return null;
  return cloudGet(meta.cloudBinId);
}
