/** Last ~8 roll results — local only, never couple-synced. */

export type RollDish = { id: string; name: string };

export type RollSnap = {
  at: number;
  dishes: RollDish[];
};

const KEY = "jte.roll-history";
const MAX_SNAPS = 8;
const MAX_CHIPS = 12;

function isDish(value: unknown): value is RollDish {
  if (!value || typeof value !== "object") return false;
  const item = value as RollDish;
  return typeof item.id === "string" && item.id.length > 0 && typeof item.name === "string" && item.name.length > 0;
}

function isSnap(value: unknown): value is RollSnap {
  if (!value || typeof value !== "object") return false;
  const snap = value as RollSnap;
  return typeof snap.at === "number" && Array.isArray(snap.dishes) && snap.dishes.every(isDish);
}

export function loadRollHistory(): RollSnap[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnap).slice(0, MAX_SNAPS);
  } catch {
    return [];
  }
}

export function pushRollHistory(dishes: RollDish[]): RollSnap[] {
  const clean = dishes.filter(isDish);
  if (clean.length === 0) return loadRollHistory();
  const next: RollSnap[] = [{ at: Date.now(), dishes: clean }, ...loadRollHistory()].slice(0, MAX_SNAPS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("jte-roll-history"));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearRollHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("jte-roll-history"));
  } catch {
    /* ignore */
  }
}

/** Newest-first unique dishes across recent rolls — for chip row. */
export function flattenRollChips(max = MAX_CHIPS): RollDish[] {
  const seen = new Set<string>();
  const out: RollDish[] = [];
  for (const snap of loadRollHistory()) {
    for (const dish of snap.dishes) {
      if (seen.has(dish.id)) continue;
      seen.add(dish.id);
      out.push(dish);
      if (out.length >= max) return out;
    }
  }
  return out;
}
