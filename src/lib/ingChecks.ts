/** Per-dish ingredient checkoffs — local only, not couple-synced. */

const KEY = "jte.ingChecks.v1";

type Store = Record<string, string[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Store = {};
    for (const [dishId, names] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof dishId !== "string" || !dishId) continue;
      if (!Array.isArray(names)) continue;
      const list = names.filter((n): n is string => typeof n === "string" && n.length > 0);
      if (list.length > 0) out[dishId] = list;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function loadIngChecks(dishId: string): string[] {
  if (!dishId) return [];
  return readStore()[dishId] ?? [];
}

export function toggleIngCheck(dishId: string, ingredientName: string): string[] {
  if (!dishId || !ingredientName) return loadIngChecks(dishId);
  const store = readStore();
  const current = new Set(store[dishId] ?? []);
  if (current.has(ingredientName)) current.delete(ingredientName);
  else current.add(ingredientName);
  const next = [...current];
  if (next.length === 0) delete store[dishId];
  else store[dishId] = next;
  writeStore(store);
  return next;
}
