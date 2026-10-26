import type { AppState, LedgerEntry } from "../types.ts";

/** Logical, per-field registers. No wall-clock timestamp participates in ordering. */
export type Revision = { counter: number; actor: string };
export type Register = { revision: Revision; value: unknown };
export type SyncDocument = {
  v: 2;
  clock: number;
  registers: Record<string, Register>;
};
const LISTS = [
  "hearts",
  "menuDishIds",
  "menuPinnedIds",
  "menuLedgerIds",
  "pantry",
] as const;
const SCALARS = ["theme", "tonightNote", "hemaTemplate"] as const;
const LEDGER_FIELDS = [
  "name",
  "notes",
  "ingredients",
  "baseServings",
  "createdAt",
  "updatedAt",
] as const;
let fallbackActor: string | undefined;
export function replicaActor(): string {
  return (fallbackActor ??= `replica-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`);
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function compareRevision(a: Revision, b: Revision): number {
  return a.counter - b.counter || a.actor.localeCompare(b.actor, "en");
}
export function validDocument(raw: unknown): raw is SyncDocument {
  if (!raw || typeof raw !== "object") return false;
  const doc = raw as SyncDocument;
  if (
    doc.v !== 2 ||
    !Number.isSafeInteger(doc.clock) ||
    doc.clock < 0 ||
    doc.clock > 1e9 ||
    !doc.registers ||
    typeof doc.registers !== "object" ||
    Array.isArray(doc.registers)
  )
    return false;
  const entries = Object.entries(doc.registers);
  if (entries.length > 100000) return false;
  return entries.every(([key, reg]) => {
    if (
      !/^(field:(theme|tonightNote|hemaTemplate)|meal:[^:]+|list:(hearts|menuDishIds|menuPinnedIds|menuLedgerIds|pantry):.+|ledger:[^:]+:(alive|name|notes|ingredients|baseServings|createdAt|updatedAt))$/.test(
        key,
      ) ||
      key.length > 4000 ||
      !reg ||
      typeof reg !== "object"
    )
      return false;
    const r = reg.revision;
    return (
      !!r &&
      Number.isSafeInteger(r.counter) &&
      r.counter >= 0 &&
      r.counter <= doc.clock &&
      typeof r.actor === "string" &&
      r.actor.length > 0 &&
      r.actor.length <= 100
    );
  });
}
function valuesOf(state: AppState): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of SCALARS) values[`field:${field}`] = state[field];
  for (const [key, value] of Object.entries(state.meal))
    values[`meal:${key}`] = value;
  for (const field of LISTS)
    state[field].forEach((id, rank) => {
      values[`list:${field}:${encodeURIComponent(id)}`] = {
        present: true,
        rank,
      };
    });
  for (const entry of state.ledger) {
    const prefix = `ledger:${encodeURIComponent(entry.id)}`;
    values[`${prefix}:alive`] = true;
    for (const field of LEDGER_FIELDS)
      values[`${prefix}:${field}`] =
        entry[field] ?? (field === "baseServings" ? 2 : "");
  }
  return values;
}
export function seedDocument(state: AppState): SyncDocument {
  return {
    v: 2,
    clock: 0,
    registers: Object.fromEntries(
      Object.entries(valuesOf(state)).map(([key, value]) => [
        key,
        { revision: { counter: 0, actor: "legacy" }, value },
      ]),
    ),
  };
}
export function mergeDocuments(a: SyncDocument, b: SyncDocument): SyncDocument {
  const registers = { ...a.registers };
  for (const [key, incoming] of Object.entries(b.registers)) {
    const local = registers[key];
    const compare = local
      ? compareRevision(incoming.revision, local.revision)
      : 1;
    if (
      !local ||
      compare > 0 ||
      (compare === 0 &&
        JSON.stringify(incoming.value) > JSON.stringify(local.value))
    )
      registers[key] = incoming;
  }
  return { v: 2, clock: Math.max(a.clock, b.clock), registers };
}
export function recordSharedChanges(
  before: AppState,
  after: AppState,
  actor = replicaActor(),
): AppState {
  const base =
    before.sync && validDocument(before.sync)
      ? before.sync
      : seedDocument(before);
  const prev = valuesOf(before),
    next = valuesOf(after);
  const registers = { ...base.registers };
  const revision = { counter: base.clock + 1, actor };
  let changed = false;
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (same(prev[key], next[key])) continue;
    changed = true;
    let value = next[key];
    if (value === undefined) {
      if (key.startsWith("list:")) value = { present: false, rank: 0 };
      else if (key.endsWith(":alive")) value = false;
      else continue; // Preserve fields behind a ledger deletion tombstone.
    }
    registers[key] = { revision, value };
  }
  return {
    ...after,
    sync: changed ? { v: 2, clock: revision.counter, registers } : base,
  };
}
export function documentFor(state: AppState): SyncDocument {
  if (!state.sync || !validDocument(state.sync)) return seedDocument(state);
  const projected = projectDocument(state.sync, state);
  return recordSharedChanges(projected, state).sync!;
}
export function projectDocument(doc: SyncDocument, local: AppState): AppState {
  const next: AppState = { ...local, meal: { ...local.meal }, sync: doc };
  for (const field of SCALARS) {
    const value = doc.registers[`field:${field}`]?.value;
    if (value !== undefined) Object.assign(next, { [field]: value });
  }
  for (const key of Object.keys(next.meal)) {
    const value = doc.registers[`meal:${key}`]?.value;
    if (value !== undefined) Object.assign(next.meal, { [key]: value });
  }
  for (const field of LISTS) {
    next[field] = Object.entries(doc.registers)
      .filter(
        ([key, reg]) =>
          key.startsWith(`list:${field}:`) &&
          (reg.value as { present?: boolean })?.present === true,
      )
      .map(([key, reg]) => ({
        id: decodeURIComponent(key.slice(`list:${field}:`.length)),
        rank: Number((reg.value as { rank: number }).rank),
      }))
      .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id, "en"))
      .map((item) => item.id);
  }
  const entries: LedgerEntry[] = [];
  for (const [key, reg] of Object.entries(doc.registers)) {
    if (
      !key.startsWith("ledger:") ||
      !key.endsWith(":alive") ||
      reg.value !== true
    )
      continue;
    const id = decodeURIComponent(key.slice(7, -6));
    const entry: Record<string, unknown> = { id };
    for (const field of LEDGER_FIELDS)
      entry[field] =
        doc.registers[`ledger:${encodeURIComponent(id)}:${field}`]?.value;
    const photo = local.ledger.find((item) => item.id === id)?.image;
    if (photo) entry.image = photo;
    entries.push(entry as LedgerEntry);
  }
  next.ledger = entries.sort(
    (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id, "en"),
  );
  const ledgerIds = new Set(next.ledger.map((entry) => entry.id));
  next.menuLedgerIds = next.menuLedgerIds.filter((id) => ledgerIds.has(id));
  next.menuPinnedIds = next.menuPinnedIds.filter((id) =>
    next.menuDishIds.includes(id),
  );
  return next;
}
export function mergeSharedStates(local: AppState, remote: AppState): AppState {
  return projectDocument(
    mergeDocuments(documentFor(local), documentFor(remote)),
    local,
  );
}
