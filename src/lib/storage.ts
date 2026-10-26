import { isTheme, parseAppState } from "./stateSchema.ts";
import { DEFAULT_HEMA_TEMPLATE } from "./hema.ts";
import { sanitizeMeal } from "./meal.ts";
import type { AppState } from "../types.ts";

export const STATE_KEY = "jte.v1";
export const THEME_KEY = "jte.theme";

export const CORRUPT_STATE_KEY = "jte.recovery.corrupt.v1";
let blockedWrite = false;

export function emptyState(): AppState {
  return {
    theme: "cafe-journal",
    hearts: [],
    menuDishIds: [],
    menuPinnedIds: [],
    menuLedgerIds: [],
    extras: [],
    bought: [],
    pantry: [],
    ledger: [],
    meal: sanitizeMeal(undefined),
    tonightNote: "",
    hemaTemplate: DEFAULT_HEMA_TEMPLATE,
  };
}

export function loadState(): AppState {
  const base = emptyState();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      const themeOnly = localStorage.getItem(THEME_KEY);
      if (isTheme(themeOnly)) base.theme = themeOnly;
      return base;
    }
    const parsed = parseAppState(JSON.parse(raw));
    if (parsed) return parsed;
    throw new Error("状态格式无效");
  } catch {
    // Never overwrite damaged or temporarily inaccessible data without a recovery copy.
    blockedWrite = true;
    if (raw !== null) {
      try {
        localStorage.setItem(CORRUPT_STATE_KEY, raw);
        blockedWrite = false;
      } catch {
        /* preserve the original key if quota/access prevents a recovery copy */
      }
    }
    return base;
  }
}

export function saveState(state: AppState, replaceCorrupt = false): AppState {
  if (blockedWrite && !replaceCorrupt)
    throw new Error("原数据暂不可读，已暂停写入");
  const valid = parseAppState(state);
  if (!valid) throw new Error("状态格式无效，未写入");
  if (valid.sync)
    valid.sync.registers = Object.fromEntries(
      Object.entries(valid.sync.registers).sort(([a], [b]) =>
        a.localeCompare(b, "en"),
      ),
    );
  const previous = localStorage.getItem(STATE_KEY),
    theme = localStorage.getItem(THEME_KEY);
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(valid));
    localStorage.setItem(THEME_KEY, valid.theme);
  } catch (error) {
    if (previous === null) localStorage.removeItem(STATE_KEY);
    else localStorage.setItem(STATE_KEY, previous);
    if (theme === null) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
    throw error;
  }
  blockedWrite = false;
  return valid;
}
