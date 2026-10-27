/** Local backup export/import — no peer secrets / cloud bin ids. */
import { recordSharedChanges } from "./replica.ts";
import { loadState, saveState } from "./storage.ts";
import type { AppState, ExtraItem, LedgerEntry } from "../types.ts";
import { loadHapticsEnabled, saveHapticsEnabled } from "./haptics.ts";
import { loadCookSpeak, saveCookSpeak } from "./cookSpeak.ts";
import {
  applyDensity,
  loadDensity,
  saveDensity,
  type ListDensity,
} from "./density.ts";
import {
  applyGridCols,
  loadGridCols,
  saveGridCols,
  type GridColsPref,
} from "./gridCols.ts";
import {
  applyGridGap,
  loadGridGap,
  saveGridGap,
  type GridGapPref,
} from "./gridGap.ts";
import { loadHideBought, saveHideBought } from "./shopHideBought.ts";
import { loadDisplayNick, saveDisplayNick } from "./nicks.ts";
import { loadAllStepChecks, saveAllStepChecks } from "./stepChecks.ts";
import { dishById } from "../data/catalog.ts";
import { APP_VERSION } from "./version.ts";
import { isRecord, parseAppState } from "./stateSchema.ts";

export const BACKUP_KIND = "jte-backup";
export const BACKUP_V = 1;
export const BACKUP_RECOVERY_KEY = "jte.backup.recovery.v1";
export const SYNC_RECOVERY_KEY = "jte.sync.recovery.v1";
const LOCAL_KEYS = [
  "jte.servings.byDish",
  "jte.servings.default",
  "jte.servings.tonightUnified",
  "jte.servings.tonightSnap",
  "jte.ingChecks.v1",
  "jte.roll-exclude",
  "jte.roll-ledger-exclude",
  "jte.roll-ledger-exclude-days",
  "jte.roll-reject.v1",
  "jte.cook-wake",
  "jte.timer-chime",
  "jte.theme-pulse",
  "jte.shop-group-mode",
  "jte.want-sort",
  "jte.want-not-tonight",
  "jte.refined-only",
];

export type LocalBackup = {
  kind: typeof BACKUP_KIND;
  v: typeof BACKUP_V;
  exportedAt: number;
  appVersion: string;
  state: AppState;
  prefs: {
    haptics: boolean;
    cookSpeak: boolean;
    density: ListDensity;
    gridCols: GridColsPref;
    gridGap?: GridGapPref;
    hideBought: boolean;
    displayNick: string;
  };
  stepChecks: Record<string, number[]>;
  localData?: Record<string, string>;
};

export type BackupImportMode = "overwrite" | "merge";

export function buildLocalBackup(): LocalBackup {
  return {
    kind: BACKUP_KIND,
    v: BACKUP_V,
    exportedAt: Date.now(),
    appVersion: APP_VERSION,
    state: loadState(),
    prefs: {
      haptics: loadHapticsEnabled(),
      cookSpeak: loadCookSpeak(),
      density: loadDensity(),
      gridCols: loadGridCols(),
      gridGap: loadGridGap(),
      hideBought: loadHideBought(),
      displayNick: loadDisplayNick(),
    },
    stepChecks: loadAllStepChecks(),
    localData: Object.fromEntries(
      LOCAL_KEYS.flatMap((key) => {
        const value = localStorage.getItem(key);
        return value === null ? [] : [[key, value]];
      }),
    ),
  };
}

export function parseLocalBackup(raw: unknown): LocalBackup | null {
  if (!isRecord(raw)) return null;
  const data = raw;
  if (data.kind !== BACKUP_KIND || data.v !== BACKUP_V) return null;
  const state = parseAppState(data.state);
  if (
    !state ||
    typeof data.exportedAt !== "number" ||
    !Number.isFinite(data.exportedAt) ||
    data.exportedAt < 0
  )
    return null;
  if (typeof data.appVersion !== "string" || data.appVersion.length > 100)
    return null;
  const p = data.prefs;
  if (
    !isRecord(p) ||
    typeof p.haptics !== "boolean" ||
    typeof p.cookSpeak !== "boolean" ||
    typeof p.hideBought !== "boolean" ||
    typeof p.displayNick !== "string" ||
    p.displayNick.length > 100 ||
    !["comfort", "compact"].includes(p.density as string) ||
    !["auto", "2", "3", "4"].includes(p.gridCols as string) ||
    (p.gridGap !== undefined &&
      !["tight", "standard", "loose"].includes(p.gridGap as string))
  )
    return null;
  if (!isRecord(data.stepChecks) || Object.keys(data.stepChecks).length > 10000)
    return null;
  for (const [key, steps] of Object.entries(data.stepChecks)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(key) ||
      key.length > 1000 ||
      !Array.isArray(steps) ||
      steps.length > 10000 ||
      !steps.every((step) => Number.isSafeInteger(step) && step >= 0)
    )
      return null;
  }
  if (
    data.localData !== undefined &&
    (!isRecord(data.localData) ||
      Object.entries(data.localData).some(
        ([key, value]) =>
          !LOCAL_KEYS.includes(key) ||
          typeof value !== "string" ||
          value.length > 1_000_000,
      ))
  )
    return null;
  return {
    kind: BACKUP_KIND,
    v: BACKUP_V,
    exportedAt: data.exportedAt,
    appVersion: data.appVersion,
    state,
    prefs: p as LocalBackup["prefs"],
    stepChecks: data.stepChecks as LocalBackup["stepChecks"],
    localData: data.localData as LocalBackup["localData"],
  };
}

/** Recovery is persisted before any import writes; quota failure aborts the import. */
function withRecovery(write: () => void): void {
  const previous = new Map<string, string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("jte.") && key !== BACKUP_RECOVERY_KEY)
      previous.set(key, localStorage.getItem(key)!);
  }
  localStorage.setItem(BACKUP_RECOVERY_KEY, JSON.stringify(buildLocalBackup()));
  try {
    write();
  } catch (error) {
    const added: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key?.startsWith("jte.") &&
        key !== BACKUP_RECOVERY_KEY &&
        !previous.has(key)
      )
        added.push(key);
    }
    for (const key of added) localStorage.removeItem(key);
    for (const [key, value] of previous) localStorage.setItem(key, value);
    throw error;
  }
}

function requireBackup(raw: LocalBackup): LocalBackup {
  const backup = parseLocalBackup(raw);
  if (!backup) throw new Error("备份格式不完整，未修改本机数据");
  return backup;
}

function uniqIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mergeIdLists(
  local: string[],
  remote: string[],
  allow?: (id: string) => boolean,
): string[] {
  const filter = allow ?? (() => true);
  return uniqIds([...local, ...remote].filter(filter));
}

function mergeLedger(
  local: LedgerEntry[],
  remote: LedgerEntry[],
): LedgerEntry[] {
  const map = new Map<string, LedgerEntry>();
  for (const entry of local) map.set(entry.id, entry);
  for (const entry of remote) {
    const cur = map.get(entry.id);
    if (!cur || (entry.updatedAt ?? 0) >= (cur.updatedAt ?? 0))
      map.set(entry.id, entry);
  }
  return Array.from(map.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  );
}

function mergeExtras(local: ExtraItem[], remote: ExtraItem[]): ExtraItem[] {
  const map = new Map<string, ExtraItem>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) if (!map.has(item.id)) map.set(item.id, item);
  return Array.from(map.values());
}

function mergeStepChecks(
  local: Record<string, number[]>,
  remote: Record<string, number[]>,
): Record<string, number[]> {
  const out: Record<string, number[]> = { ...local };
  for (const [id, steps] of Object.entries(remote || {})) {
    const a = new Set(out[id] ?? []);
    for (const n of steps || []) if (typeof n === "number") a.add(n);
    out[id] = Array.from(a).sort((x, y) => x - y);
  }
  return out;
}

function applyPrefs(p: LocalBackup["prefs"] | undefined): void {
  if (!p) return;
  saveHapticsEnabled(Boolean(p.haptics));
  saveCookSpeak(Boolean(p.cookSpeak));
  if (p.density === "comfort" || p.density === "compact") {
    saveDensity(p.density);
    applyDensity(p.density);
  }
  if (
    p.gridCols === "auto" ||
    p.gridCols === "2" ||
    p.gridCols === "3" ||
    p.gridCols === "4"
  ) {
    saveGridCols(p.gridCols);
    applyGridCols(p.gridCols);
  }
  if (
    p.gridGap === "tight" ||
    p.gridGap === "standard" ||
    p.gridGap === "loose"
  ) {
    saveGridGap(p.gridGap);
    applyGridGap(p.gridGap);
  }
  saveHideBought(Boolean(p.hideBought));
  if (typeof p.displayNick === "string") saveDisplayNick(p.displayNick);
  if (
    loadHapticsEnabled() !== p.haptics ||
    loadCookSpeak() !== p.cookSpeak ||
    loadHideBought() !== p.hideBought ||
    loadDensity() !== p.density ||
    loadGridCols() !== p.gridCols ||
    (p.gridGap !== undefined && loadGridGap() !== p.gridGap)
  ) {
    throw new Error("偏好保存失败");
  }
}

/** Full replace — including prefs. Never touches couple room secrets. */
export function applyLocalBackup(backup: LocalBackup): void {
  const valid = requireBackup(backup);
  withRecovery(() => {
    saveState(recordSharedChanges(loadState(), valid.state), true);
    applyPrefs(valid.prefs);
    saveAllStepChecks(valid.stepChecks);
    if (valid.localData) {
      for (const key of LOCAL_KEYS) {
        const value = valid.localData[key];
        if (value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    }
  });
}

/**
 * Merge strategy (clear, documented in UI):
 * - 想吃 / 今晚菜 / 今晚账本 id：去重合并（本机顺序在前）
 * - 账本：同 id 留较新 updatedAt
 * - 采购勾选 / 常备 / 加购：去重合并
 * - 备忘：本机非空则留本机，否则用备份
 * - 几菜几汤 / 皮肤 / 盒马模板：保留本机
 * - 偏好（触感·疏密等）：保留本机
 * - 步骤勾选：按菜 id 合并
 */
export function mergeLocalBackup(backup: LocalBackup): void {
  backup = requireBackup(backup);
  const local = loadState();
  const remote = backup.state;
  const ledger = mergeLedger(local.ledger || [], remote.ledger || []);
  const ledgerIds = new Set(ledger.map((e) => e.id));
  const menuDishIds = mergeIdLists(
    local.menuDishIds,
    remote.menuDishIds,
    (id) => dishById.has(id),
  );
  const menuSet = new Set(menuDishIds);
  const menuPinnedIds = mergeIdLists(
    local.menuPinnedIds || [],
    remote.menuPinnedIds || [],
    (id) => menuSet.has(id),
  );
  const next: AppState = {
    ...local,
    hearts: mergeIdLists(local.hearts, remote.hearts, (id) => dishById.has(id)),
    menuDishIds,
    menuPinnedIds,
    menuLedgerIds: mergeIdLists(
      local.menuLedgerIds,
      remote.menuLedgerIds,
      (id) => ledgerIds.has(id),
    ),
    ledger,
    extras: mergeExtras(local.extras || [], remote.extras || []),
    bought: mergeIdLists(local.bought || [], remote.bought || []),
    pantry: mergeIdLists(local.pantry || [], remote.pantry || []),
    tonightNote: (local.tonightNote || "").trim()
      ? local.tonightNote
      : typeof remote.tonightNote === "string"
        ? remote.tonightNote
        : local.tonightNote,
    /* theme / meal / hemaTemplate stay local */
  };
  /* prefs: keep local — do not applyPrefs(backup.prefs) */
  const mergedChecks = mergeStepChecks(
    loadAllStepChecks(),
    backup.stepChecks || {},
  );
  withRecovery(() => {
    saveState(recordSharedChanges(local, next), true);
    saveAllStepChecks(mergedChecks);
  });
}

export function downloadLocalBackup(recovery = false): void {
  const backup = recovery
    ? parseLocalBackup(
        JSON.parse(localStorage.getItem(BACKUP_RECOVERY_KEY) || "null"),
      )
    : buildLocalBackup();
  if (!backup) throw new Error("还没有导入前恢复点");
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `今天吃什么-${recovery ? "导入前恢复点" : "备份"}-${day}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function preserveBeforeSync(): void {
  localStorage.setItem(SYNC_RECOVERY_KEY, JSON.stringify(buildLocalBackup()));
}

export function downloadSyncRecovery(): void {
  const backup = parseLocalBackup(
    JSON.parse(localStorage.getItem(SYNC_RECOVERY_KEY) || "null"),
  );
  if (!backup) throw new Error("还没有同步前恢复点");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "今天吃什么-同步前恢复点.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
