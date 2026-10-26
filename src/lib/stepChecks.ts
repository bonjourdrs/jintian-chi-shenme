/** Per-dish cooking step checkoffs — local only, not couple-synced. */

const KEY = "jte.stepChecks.v1";

type Store = Record<string, number[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Store = {};
    for (const [dishId, idxs] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof dishId !== "string" || !dishId) continue;
      if (!Array.isArray(idxs)) continue;
      const list = [
        ...new Set(
          idxs.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0),
        ),
      ].sort((a, b) => a - b);
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

export function loadStepChecks(dishId: string): number[] {
  if (!dishId) return [];
  return readStore()[dishId] ?? [];
}

export function toggleStepCheck(dishId: string, stepIndex: number): number[] {
  if (!dishId || !Number.isInteger(stepIndex) || stepIndex < 0) return loadStepChecks(dishId);
  const store = readStore();
  const current = new Set(store[dishId] ?? []);
  if (current.has(stepIndex)) current.delete(stepIndex);
  else current.add(stepIndex);
  const next = [...current].sort((a, b) => a - b);
  if (next.length === 0) delete store[dishId];
  else store[dishId] = next;
  writeStore(store);
  return next;
}

/** First incomplete step index, or last if all done. */
export function firstIncompleteStep(done: number[], total: number): number {
  if (total <= 0) return 0;
  for (let i = 0; i < total; i++) {
    if (!done.includes(i)) return i;
  }
  return total - 1;
}

export function loadAllStepChecks(): Record<string, number[]> {
  return readStore();
}

export function saveAllStepChecks(store: Record<string, number[]>): void {
  if (!store || typeof store !== "object") {
    writeStore({});
    return;
  }
  const clean: Store = {};
  for (const [dishId, idxs] of Object.entries(store)) {
    if (typeof dishId !== "string" || !dishId) continue;
    if (!Array.isArray(idxs)) continue;
    const list = [
      ...new Set(
        idxs.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0),
      ),
    ].sort((a, b) => a - b);
    if (list.length > 0) clean[dishId] = list;
  }
  writeStore(clean);
}

export function clearStepChecks(dishId: string): void {
  if (!dishId) return;
  const store = readStore();
  if (!(dishId in store)) return;
  delete store[dishId];
  writeStore(store);
}

/** Drop checkoffs for these dish ids (e.g. removed from tonight). */
export function clearStepChecksForIds(ids: string[]): void {
  if (!ids.length) return;
  const store = readStore();
  let changed = false;
  for (const id of ids) {
    if (!id || !(id in store)) continue;
    delete store[id];
    changed = true;
  }
  if (changed) writeStore(store);
}

