import type {
  AppState,
  ExtraItem,
  LedgerEntry,
  MealConfig,
  ThemeId,
} from "../types.ts";
import {
  documentFor,
  mergeSharedStates,
  validDocument,
  projectDocument,
  type SyncDocument,
} from "./replica.ts";
import { emptyState } from "./storage.ts";
import { parseAppState } from "./stateSchema.ts";
import { isExtra, isLedger, isStringList, validMeal } from "./stateSchema.ts";
import { LIVE_URL } from "./version.ts";
import { dishById } from "../data/catalog.ts";
import { DEFAULT_HEMA_TEMPLATE } from "./hema.ts";
import { loadDisplayNick, sanitizeNick } from "./nicks.ts";
import { sanitizeMeal } from "./meal.ts";

export const ROOM_KEY = "jte.couple.room.v1";
export const SYNC_PREFIX = "JTE2:";

/** Monotonic clock for last-write-wins. Never compare against a fresh Date.now(). */
const CLOCK_KEY = "jte.sync.clock.v1";
let syncClock = readClock();

function readClock(): number {
  try {
    const value = Number(localStorage.getItem(CLOCK_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function persistClock(): void {
  try {
    localStorage.setItem(CLOCK_KEY, String(syncClock));
  } catch {
    /* main state reports storage errors */
  }
}

export function peekSyncClock(): number {
  return syncClock;
}

export function bumpSyncClock(at = Date.now()): number {
  syncClock = Math.max(syncClock + 1, at);
  persistClock();
  return syncClock;
}

export function adoptSyncClock(at: number): void {
  if (typeof at === "number" && Number.isFinite(at)) {
    syncClock = Math.max(syncClock, at);
    persistClock();
  }
}

export function resetSyncClock(at = 0): void {
  syncClock = at;
  persistClock();
}

/** Guest just joined — accept the first peer/cloud payload even if local clock raced ahead. */
let acceptNextRemote = false;

export function expectInitialRemote(): void {
  acceptNextRemote = true;
}

export function shouldAcceptRemote(updatedAt: number): boolean {
  return decideRemote(updatedAt).accept;
}

export type RemoteDecision =
  | { accept: true; reason: "newer" | "initial" }
  | { accept: false; reason: "local-newer" | "same" };

/** Last-write-wins decision — never silently drop when clocks race. */
export function decideRemote(updatedAt: number): RemoteDecision {
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return { accept: false, reason: "same" };
  if (acceptNextRemote) {
    acceptNextRemote = false;
    return { accept: true, reason: "initial" };
  }
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) {
    return { accept: false, reason: "same" };
  }
  if (updatedAt > syncClock) return { accept: true, reason: "newer" };
  if (updatedAt < syncClock) return { accept: false, reason: "local-newer" };
  return { accept: false, reason: "same" };
}

/** Fingerprint synced fields that matter for conflict toast (bought stays local). */
export function syncMenuFingerprint(input: {
  menuDishIds: string[];
  /** Pinned tonight dishes (order among pins). */
  menuPinnedIds?: string[];
  menuLedgerIds: string[];
  meal: MealConfig;
  hearts: string[];
  tonightNote?: string;
  ledger?: LedgerEntry[];
  pantry?: string[];
  theme?: ThemeId;
  hemaTemplate?: string;
}): string {
  return JSON.stringify({
    d: input.menuDishIds,
    p: input.menuPinnedIds ?? [],
    l: input.menuLedgerIds,
    m: input.meal,
    h: input.hearts,
    n: input.tonightNote ?? "",
    entries: input.ledger?.map(({ image: _localImage, ...entry }) => entry),
    pantry: input.pantry,
    theme: input.theme,
    hema: input.hemaTemplate,
  });
}

export function menusDiffer(
  local: {
    menuDishIds: string[];
    menuLedgerIds: string[];
    meal: MealConfig;
    hearts: string[];
    tonightNote?: string;
  },
  remote: {
    menuDishIds: string[];
    menuLedgerIds: string[];
    meal: MealConfig;
    hearts: string[];
    tonightNote?: string;
  },
): boolean {
  return syncMenuFingerprint(local) !== syncMenuFingerprint(remote);
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function validateRoomCode(
  raw: string,
): { ok: true; code: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "先填房间号" };
  const code = normalizeRoomCode(raw);
  if (!code)
    return { ok: false, message: "房间号只含字母和数字，去掉空格再试" };
  if (code.length < 4) return { ok: false, message: "房间号太短，新版是 8 位" };
  if (code.length > 8)
    return { ok: false, message: "房间号太长，看看有没有多粘了别的字" };
  if (!/^[A-Z0-9]+$/.test(code))
    return { ok: false, message: "房间号格式不对" };
  return { ok: true, code };
}

export type CoupleRoomMeta = {
  cloudProtocol?: 2;
  cloudRevision?: number;
  lastCloudSavedAt?: number;
  lastPeerSentId?: string;
  lastPeerAckId?: string;
  lastPeerAckAt?: number;
  code: string;
  role: "host" | "guest";
  cloudBinId?: string;
  lastSyncedAt?: number;
  lastError?: string;
  /** Your display nick (also kept in jte.display-nick). Does not affect room code. */
  myNick?: string;
  /** Partner nick last seen via sync. */
  partnerNick?: string;
};

export type SyncPayload = {
  sync?: SyncDocument;
  v: 1;
  updatedAt: number;
  theme?: ThemeId;
  hearts: string[];
  menuDishIds: string[];
  /** Pinned tonight dishes (order among pins). */
  menuPinnedIds?: string[];
  menuLedgerIds: string[];
  meal: MealConfig;
  tonightNote?: string;
  /** Couple display nicks by role — never rewrite room code. */
  coupleNicks?: { host?: string; guest?: string };
  ledger: LedgerEntry[];
  extras: ExtraItem[];
  /** @deprecated local-only; omitted on wire since v65 */
  bought?: string[];
  pantry: string[];
  hemaTemplate: string;
};

const THEMES: ThemeId[] = [
  "cafe-journal",
  "kitchen-chalkboard",
  "watercolor-market",
  "midnight-magazine",
];

function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.includes(value as ThemeId);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

/** Drop large ledger photos from wire; keep tiny thumbs only. Never send bought. */
function slimLedger(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.map((entry) => {
    if (!entry.image) return entry;
    /* data: URLs / base64 blow sync packs — keep only very small thumbs */
    if (entry.image.length <= 4000) return entry;
    const { image: _drop, ...rest } = entry;
    return rest;
  });
}

export function estimateSyncPayloadBytes(payload: SyncPayload): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return JSON.stringify(payload).length;
  }
}

export function formatSyncBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n >= 10_240 ? 0 : 1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildSyncPayload(
  state: AppState,
  updatedAt?: number,
): SyncPayload {
  const room = loadRoomMeta();
  const my = sanitizeNick(loadDisplayNick() || room?.myNick || "");
  let coupleNicks: SyncPayload["coupleNicks"];
  if (room) {
    const host =
      room.role === "host" ? my : sanitizeNick(room.partnerNick || "");
    const guest =
      room.role === "guest" ? my : sanitizeNick(room.partnerNick || "");
    if (host || guest) {
      coupleNicks = {
        host: host || undefined,
        guest: guest || undefined,
      };
    }
  }
  const note = (state.tonightNote || "").trim().slice(0, 120);
  const pantry = state.pantry.filter(Boolean);
  const hema =
    state.hemaTemplate &&
    state.hemaTemplate.trim() &&
    state.hemaTemplate !== DEFAULT_HEMA_TEMPLATE
      ? state.hemaTemplate.trim()
      : undefined;
  const payload: SyncPayload = {
    v: 1,
    updatedAt: updatedAt ?? documentFor(state).clock,
    sync: documentFor(state),
    theme: state.theme,
    hearts: state.hearts,
    menuDishIds: state.menuDishIds,
    menuPinnedIds: (state.menuPinnedIds || []).filter((id) =>
      state.menuDishIds.includes(id),
    ),
    menuLedgerIds: state.menuLedgerIds,
    meal: state.meal,
    ledger: slimLedger(state.ledger),
    /* extras + bought: 采购临时项/勾选只留本机，不进同步包 */
    extras: [],
    pantry: pantry.length ? pantry : [],
    hemaTemplate: hema || DEFAULT_HEMA_TEMPLATE,
  };
  if (note) payload.tonightNote = note;
  if (coupleNicks) payload.coupleNicks = coupleNicks;
  return payload;
}

export function parseSyncPayload(raw: unknown): SyncPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SyncPayload>;
  if (
    data.v !== 1 ||
    typeof data.updatedAt !== "number" ||
    !Number.isFinite(data.updatedAt) ||
    data.updatedAt < 0
  )
    return null;
  if (!Number.isSafeInteger(data.updatedAt) || !validMeal(data.meal))
    return null;
  if (
    ![data.hearts, data.menuDishIds, data.menuLedgerIds, data.pantry].every(
      isStringList,
    )
  )
    return null;
  if (
    !Array.isArray(data.ledger) ||
    data.ledger.length > 10000 ||
    !data.ledger.every(isLedger)
  )
    return null;
  if (data.sync !== undefined && !validDocument(data.sync)) return null;
  if (data.sync) {
    try {
      const candidate = projectDocument(data.sync, {
        ...emptyState(),
        ledger: data.ledger!,
      });
      if (!parseAppState(candidate)) return null;
    } catch {
      return null;
    }
  }
  const ledger = Array.isArray(data.ledger) ? data.ledger.filter(isLedger) : [];
  const ledgerIds = new Set(ledger.map((entry) => entry.id));
  return {
    v: 1,
    updatedAt: data.updatedAt,
    ...(data.sync ? { sync: data.sync } : {}),
    theme: isTheme(data.theme) ? data.theme : undefined,
    hearts: strings(data.hearts).filter((id) => dishById.has(id)),
    menuDishIds: strings(data.menuDishIds).filter((id) => dishById.has(id)),
    menuPinnedIds: (() => {
      const ids = strings(data.menuDishIds).filter((id) => dishById.has(id));
      const set = new Set(ids);
      return strings(data.menuPinnedIds).filter((id) => set.has(id));
    })(),
    menuLedgerIds: strings(data.menuLedgerIds).filter((id) =>
      ledgerIds.has(id),
    ),
    meal: sanitizeMeal(data.meal),
    tonightNote:
      typeof data.tonightNote === "string"
        ? data.tonightNote.slice(0, 120)
        : undefined,
    coupleNicks: (() => {
      const raw = data.coupleNicks;
      if (!raw || typeof raw !== "object") return undefined;
      const host = typeof raw.host === "string" ? sanitizeNick(raw.host) : "";
      const guest =
        typeof raw.guest === "string" ? sanitizeNick(raw.guest) : "";
      if (!host && !guest) return undefined;
      return { host: host || undefined, guest: guest || undefined };
    })(),
    ledger,
    extras: Array.isArray(data.extras) ? data.extras.filter(isExtra) : [],
    bought: [] /* ignore remote; applySync keeps local */,
    pantry: strings(data.pantry),
    hemaTemplate:
      typeof data.hemaTemplate === "string" && data.hemaTemplate.trim()
        ? data.hemaTemplate
        : DEFAULT_HEMA_TEMPLATE,
  };
}

export function applySyncPayload(
  state: AppState,
  payload: SyncPayload,
): AppState {
  const remote: AppState = {
    ...emptyState(),
    ...payload,
    theme: payload.theme ?? state.theme,
    menuPinnedIds: payload.menuPinnedIds ?? [],
    tonightNote: payload.tonightNote ?? "",
    extras: [],
    bought: [],
    ledger: payload.ledger.map((entry) => ({
      ...entry,
      image:
        state.ledger.find((local) => local.id === entry.id)?.image ??
        entry.image,
    })),
  };
  const merged = mergeSharedStates(state, remote);
  const valid = parseAppState(merged);
  if (!valid) throw new Error("同步数据格式无效");
  return valid;
}

export function encodeSyncPack(payload: SyncPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${SYNC_PREFIX}${btoa(binary)}`;
}

export function decodeSyncPack(text: string): SyncPayload | null {
  let trimmed = text.trim().replace(/^\uFEFF/, "");
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  try {
    const prefix = SYNC_PREFIX;
    if (
      trimmed.slice(0, prefix.length).toUpperCase() === prefix.toUpperCase()
    ) {
      const b64 = trimmed.slice(prefix.length).replace(/\s+/g, "");
      const binary = atob(b64);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      return parseSyncPayload(JSON.parse(json));
    }
    return parseSyncPayload(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function loadRoomMeta(): CoupleRoomMeta | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoupleRoomMeta;
    if (!parsed?.code || (parsed.role !== "host" && parsed.role !== "guest"))
      return null;
    const code = normalizeRoomCode(parsed.code);
    if (!code) return null;
    return {
      ...parsed,
      code,
      myNick:
        typeof parsed.myNick === "string"
          ? sanitizeNick(parsed.myNick)
          : undefined,
      partnerNick:
        typeof parsed.partnerNick === "string"
          ? sanitizeNick(parsed.partnerNick)
          : undefined,
    };
  } catch {
    return null;
  }
}

export function saveRoomMeta(meta: CoupleRoomMeta | null): void {
  try {
    if (!meta) localStorage.removeItem(ROOM_KEY);
    else localStorage.setItem(ROOM_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new Event("jte-room-changed"));
  } catch {
    /* ignore */
  }
}

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomRoomCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
  return out;
}

export function peerIdForRoom(code: string): string {
  return `jte2-${normalizeRoomCode(code)}`;
}

export function inviteText(code: string): string {
  const room = normalizeRoomCode(code);
  const lines = [
    "来「今天吃什么」一起定晚饭～",
    "房间号：" + room,
    "打开：" + LIVE_URL,
    "路径：我们 → 两人同步 → 输入房间号加入。",
    "不同条目会自动合并；同一字段同时修改时按修订顺序处理。",
    "知道房间号的人都能读写这份菜单和账本，别发给外人哦。",
  ];
  return lines.join(String.fromCharCode(10));
}

export function formatSyncTime(ts?: number): string {
  if (!ts) return "还没同步过";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString("zh-CN");
  }
}

/** Relative label for SyncChip — only when ts is known. */
export function formatSyncRelative(
  ts?: number,
  now = Date.now(),
): string | null {
  if (!ts) return null;
  const diff = Math.max(0, now - ts);
  if (diff < 45_000) return "刚刚";
  if (diff < 60_000 * 60)
    return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
  if (diff < 60_000 * 60 * 24)
    return `${Math.max(1, Math.floor(diff / (60_000 * 60)))} 小时前`;
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return formatSyncTime(ts);
  }
}
