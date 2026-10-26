import { CORRUPT_STATE_KEY, emptyState } from "./storage.ts";
import {
  isLedger,
  isExtra,
  isTheme,
  parseAppState,
  isRecord,
} from "./stateSchema.ts";
import { sanitizeMeal } from "./meal.ts";
import type { AppState } from "../types.ts";
export function corruptRecoveryExists(): boolean {
  try {
    return localStorage.getItem(CORRUPT_STATE_KEY) !== null;
  } catch {
    return false;
  }
}
export function recoverableState(): AppState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CORRUPT_STATE_KEY) || "null");
    if (!isRecord(raw)) return null;
    const clean = emptyState();
    for (const key of [
      "hearts",
      "menuDishIds",
      "menuPinnedIds",
      "menuLedgerIds",
      "pantry",
      "bought",
    ] as const) {
      if (Array.isArray(raw[key]))
        clean[key] = raw[key].filter(
          (value: unknown): value is string =>
            typeof value === "string" &&
            value.length > 0 &&
            value.length <= 1000,
        );
    }
    clean.ledger = Array.isArray(raw.ledger) ? raw.ledger.filter(isLedger) : [];
    clean.extras = Array.isArray(raw.extras) ? raw.extras.filter(isExtra) : [];
    if (isTheme(raw.theme)) clean.theme = raw.theme;
    clean.meal = sanitizeMeal(raw.meal);
    if (typeof raw.tonightNote === "string")
      clean.tonightNote = raw.tonightNote.slice(0, 120);
    if (typeof raw.hemaTemplate === "string" && raw.hemaTemplate.length <= 4000)
      clean.hemaTemplate = raw.hemaTemplate;
    return parseAppState(clean);
  } catch {
    return null;
  }
}
export function exportCorruptRecovery(): void {
  const raw = localStorage.getItem(CORRUPT_STATE_KEY);
  if (raw === null) throw new Error("没有隔离文件");
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "今天吃什么-原始隔离数据.json";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
