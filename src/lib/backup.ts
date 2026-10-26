/** Local backup export/import — no peer secrets / cloud bin ids. */
import { loadState, saveState } from "./storage.ts";
import type { AppState, ExtraItem, LedgerEntry } from "../types.ts";
import { loadHapticsEnabled, saveHapticsEnabled } from "./haptics.ts";
import { loadCookSpeak, saveCookSpeak } from "./cookSpeak.ts";
import { applyDensity, loadDensity, saveDensity, type ListDensity } from "./density.ts";
import { applyGridCols, loadGridCols, saveGridCols, type GridColsPref } from "./gridCols.ts";
import { applyGridGap, loadGridGap, saveGridGap, type GridGapPref } from "./gridGap.ts";
import { loadHideBought, saveHideBought } from "./shopHideBought.ts";
import { loadDisplayNick, saveDisplayNick } from "./nicks.ts";
import { loadAllStepChecks, saveAllStepChecks } from "./stepChecks.ts";
import { dishById } from "../data/catalog.ts";
import { APP_VERSION } from "./version.ts";

export const BACKUP_KIND = "jte-backup";
export const BACKUP_V = 1;

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
  };
}

export function parseLocalBackup(raw: unknown): LocalBackup | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<LocalBackup>;
  if (data.kind !== BACKUP_KIND || data.v !== BACKUP_V) return null;
  if (!data.state || typeof data.state !== "object") return null;
  return data as LocalBackup;
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

function mergeIdLists(local: string[], remote: string[], allow?: (id: string) => boolean): string[] {
  const filter = allow ?? (() => true);
  return uniqIds([...local, ...remote].filter(filter));
}

function mergeLedger(local: LedgerEntry[], remote: LedgerEntry[]): LedgerEntry[] {
  const map = new Map<string, LedgerEntry>();
  for (const entry of local) map.set(entry.id, entry);
  for (const entry of remote) {
    const cur = map.get(entry.id);
    if (!cur || (entry.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) map.set(entry.id, entry);
  }
  return Array.from(map.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
  if (p.gridCols === "auto" || p.gridCols === "2" || p.gridCols === "3" || p.gridCols === "4") {
    saveGridCols(p.gridCols);
    applyGridCols(p.gridCols);
  }
  if (p.gridGap === "tight" || p.gridGap === "standard" || p.gridGap === "loose") {
    saveGridGap(p.gridGap);
    applyGridGap(p.gridGap);
  }
  saveHideBought(Boolean(p.hideBought));
  if (typeof p.displayNick === "string") saveDisplayNick(p.displayNick);
}

/** Full replace — including prefs. Never touches couple room secrets. */
export function applyLocalBackup(backup: LocalBackup): void {
  saveState(backup.state);
  applyPrefs(backup.prefs);
  if (backup.stepChecks && typeof backup.stepChecks === "object") {
    saveAllStepChecks(backup.stepChecks);
  }
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
  const local = loadState();
  const remote = backup.state;
  const ledger = mergeLedger(local.ledger || [], remote.ledger || []);
  const ledgerIds = new Set(ledger.map((e) => e.id));
  const menuDishIds = mergeIdLists(local.menuDishIds, remote.menuDishIds, (id) => dishById.has(id));
  const menuSet = new Set(menuDishIds);
  const menuPinnedIds = mergeIdLists(local.menuPinnedIds || [], remote.menuPinnedIds || [], (id) =>
    menuSet.has(id),
  );
  const next: AppState = {
    ...local,
    hearts: mergeIdLists(local.hearts, remote.hearts, (id) => dishById.has(id)),
    menuDishIds,
    menuPinnedIds,
    menuLedgerIds: mergeIdLists(local.menuLedgerIds, remote.menuLedgerIds, (id) => ledgerIds.has(id)),
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
  saveState(next);
  /* prefs: keep local — do not applyPrefs(backup.prefs) */
  const mergedChecks = mergeStepChecks(loadAllStepChecks(), backup.stepChecks || {});
  saveAllStepChecks(mergedChecks);
}

export function downloadLocalBackup(): void {
  const backup = buildLocalBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `今天吃什么-备份-${day}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
