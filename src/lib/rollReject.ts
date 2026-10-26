/** Short-lived 「不要这些」excludes after a roll — local only, TTL + cap. */
const KEY = "jte.roll-reject.v1";
const TTL_MS = 30 * 60 * 1000; /* 30 minutes */
const MAX = 36;

type Entry = { id: string; until: number };

function read(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter((item): item is Entry => {
        if (!item || typeof item !== "object") return false;
        const row = item as Entry;
        return typeof row.id === "string" && row.id.length > 0 && typeof row.until === "number";
      })
      .filter((row) => row.until > now)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(entries: Entry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function loadRollRejectIds(): Set<string> {
  return new Set(read().map((e) => e.id));
}

/** Mark this batch as temporarily rejected for the next rolls. */
export function rejectRollBatch(ids: string[]): number {
  const now = Date.now();
  const until = now + TTL_MS;
  const map = new Map<string, number>();
  for (const e of read()) map.set(e.id, e.until);
  for (const id of ids) {
    if (!id) continue;
    map.set(id, until);
  }
  const next = [...map.entries()]
    .map(([id, u]) => ({ id, until: u }))
    .sort((a, b) => b.until - a.until)
    .slice(0, MAX);
  write(next);
  return ids.filter(Boolean).length;
}

export function clearRollRejects(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function rollRejectHint(): string {
  const n = loadRollRejectIds().size;
  if (n <= 0) return "";
  return `临时排除 ${n} 道（约 30 分钟）`;
}
