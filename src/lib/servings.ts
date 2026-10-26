import { formatIngredientCopyLine, scaleQuantityText } from "./amounts.ts";

/** Display-only servings scaling. Seed / overrides stay untouched. */

const BASE_SERVINGS = 2;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 8;

/**
 * Scale parseable amounts in a string by ratio (servings / base).
 * Unparseable text is returned unchanged.
 */
export function scaleAmountText(
  text: string,
  servings: number,
  base = BASE_SERVINGS,
): string {
  const s = clampServings(servings);
  if (s === base) return text;
  return scaleQuantityText(text, s / base);
}

export function clampServings(n: number): number {
  if (!Number.isFinite(n)) return BASE_SERVINGS;
  return Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, Math.round(n)));
}

export function baseServings(): number {
  return BASE_SERVINGS;
}

/** Rewrite a "两人份 · …" style note when servings ≠ 2. */
export function scaleIngredientNote(note: string, servings: number): string {
  const s = clampServings(servings);
  if (s === BASE_SERVINGS) return note;
  return note.replace(/两人份/g, `${s}人份`).replace(/2\s*人份/g, `${s}人份`);
}

/** Scale a full ingredient list for copy/share, with a 按 N 人 heading. */
export function scaleIngredientsForCopy<T extends { name: string }>(
  dishName: string,
  ingredients: T[],
  servings: number,
  noteOf: (ing: T) => string,
): string {
  const s = clampServings(servings);
  const lines: string[] = [`${dishName} · 食材（按 ${s} 人）`];
  for (const ingredient of ingredients) {
    const raw = ingredient.name.trim();
    if (!raw) continue;
    const name = scaleAmountText(raw, s);
    const fallback = scaleIngredientNote(noteOf(ingredient), s);
    const line = formatIngredientCopyLine(name, fallback);
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

const BY_DISH_KEY = "jte.servings.byDish";
const DEFAULT_KEY = "jte.servings.default";

function readByDish(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BY_DISH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value))
        out[id] = clampServings(value);
    }
    return out;
  } catch {
    return {};
  }
}

/** Last servings for a dish, else last global default, else base (2). */
export function loadServingsForDish(
  dishId: string,
  fallback = BASE_SERVINGS,
): number {
  if (!dishId) return BASE_SERVINGS;
  try {
    const map = readByDish();
    if (map[dishId] != null) return map[dishId];
    const raw = localStorage.getItem(DEFAULT_KEY);
    if (raw !== null && raw.trim() !== "") {
      const def = Number(raw);
      if (Number.isFinite(def) && def >= MIN_SERVINGS && def <= MAX_SERVINGS)
        return clampServings(def);
    }
  } catch {
    /* ignore */
  }
  return clampServings(fallback);
}

/** Persist per-dish choice (local only, not couple-synced). */
export function saveServingsForDish(dishId: string, servings: number): void {
  if (!dishId) return;
  const s = clampServings(servings);
  try {
    window.dispatchEvent(new Event("jte-before-servings-change"));
    const map = readByDish();
    map[dishId] = s;
    localStorage.setItem(BY_DISH_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event("jte-servings-changed"));
  } catch {
    /* ignore quota */
  }
}

const TONIGHT_UNIFIED_KEY = "jte.servings.tonightUnified";
const TONIGHT_SNAP_KEY = "jte.servings.tonightSnap";

export type TonightServingsSnap = Record<string, number>;

/** Current unified tonight servings, if any (local only). */
export function loadTonightUnifiedServings(): number | null {
  try {
    const raw = localStorage.getItem(TONIGHT_UNIFIED_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampServings(n);
  } catch {
    return null;
  }
}

function loadTonightSnap(): TonightServingsSnap {
  try {
    const raw = localStorage.getItem(TONIGHT_SNAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: TonightServingsSnap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value))
        out[id] = clampServings(value);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Write the same servings to every tonight dish (per-dish memory, same as详情).
 * First apply snapshots prior per-dish values so「清除」can restore.
 */
export function applyTonightUnifiedServings(
  dishIds: string[],
  servings: number,
  fallbacks: Record<string, number> = {},
): number {
  const s = clampServings(servings);
  const ids = Array.from(new Set(dishIds.filter(Boolean)));
  const existingSnap = loadTonightSnap();
  const snap: TonightServingsSnap = { ...existingSnap };
  for (const id of ids) {
    if (snap[id] == null) snap[id] = loadServingsForDish(id, fallbacks[id]);
    saveServingsForDish(id, s);
  }
  try {
    localStorage.setItem(TONIGHT_SNAP_KEY, JSON.stringify(snap));
    localStorage.setItem(TONIGHT_UNIFIED_KEY, String(s));
  } catch {
    /* ignore */
  }
  return s;
}

/** Restore each dish to the pre-unify snapshot (or base if missing). Clears unified marker. */
export function clearTonightUnifiedServings(dishIds?: string[]): number {
  const snap = loadTonightSnap();
  const ids = dishIds?.length
    ? Array.from(new Set(dishIds.filter(Boolean)))
    : Object.keys(snap);
  let restored = 0;
  for (const id of ids) {
    const prev = snap[id];
    if (prev != null) {
      saveServingsForDish(id, prev);
      restored += 1;
      delete snap[id];
    }
  }
  try {
    if (Object.keys(snap).length)
      localStorage.setItem(TONIGHT_SNAP_KEY, JSON.stringify(snap));
    else {
      localStorage.removeItem(TONIGHT_UNIFIED_KEY);
      localStorage.removeItem(TONIGHT_SNAP_KEY);
    }
  } catch {
    /* ignore */
  }
  return restored;
}
