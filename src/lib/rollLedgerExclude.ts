/** Soft-exclude dishes that appear in the ledger within recent N days — local only. */

export type LedgerExcludeDays = 3 | 7 | 14;

const ON_KEY = "jte.roll-ledger-exclude";
const DAYS_KEY = "jte.roll-ledger-exclude-days";

export function loadRollLedgerExclude(): boolean {
  try {
    const raw = localStorage.getItem(ON_KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return false; /* default off — opt-in */
}

export function saveRollLedgerExclude(on: boolean): void {
  try {
    localStorage.setItem(ON_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadRollLedgerDays(): LedgerExcludeDays {
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    const n = Number(raw);
    if (n === 3 || n === 7 || n === 14) return n;
  } catch {
    /* ignore */
  }
  return 7;
}

export function saveRollLedgerDays(days: LedgerExcludeDays): void {
  try {
    localStorage.setItem(DAYS_KEY, String(days));
  } catch {
    /* ignore */
  }
}

/** Match ledger entry names (case-insensitive trim) to catalog dish ids. */
export function ledgerRecentDishIds(
  ledger: Array<{ name: string; createdAt: number; updatedAt?: number }>,
  catalog: Array<{ id: string; name: string }>,
  days: number,
  now = Date.now(),
): Set<string> {
  const since = now - Math.max(1, days) * 86_400_000;
  const names = new Set<string>();
  for (const entry of ledger) {
    const at = typeof entry.updatedAt === "number" ? entry.updatedAt : entry.createdAt;
    if (typeof at !== "number" || at < since) continue;
    const n = (entry.name || "").trim().toLowerCase();
    if (n) names.add(n);
  }
  const ids = new Set<string>();
  if (names.size === 0) return ids;
  for (const dish of catalog) {
    if (names.has(dish.name.trim().toLowerCase())) ids.add(dish.id);
  }
  return ids;
}
