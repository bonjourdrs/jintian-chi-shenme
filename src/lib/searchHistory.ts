/** Recent search queries — local ring buffer, not synced. */

const KEY = "jte.searchHistory";
const MAX = 8;

function isQuery(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!isQuery(item)) continue;
      const q = item.trim();
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
      if (out.length >= MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function pushSearchHistory(query: string): string[] {
  const q = query.trim();
  if (!q) return loadSearchHistory();
  const key = q.toLowerCase();
  const next = [q, ...loadSearchHistory().filter((item) => item.toLowerCase() !== key)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return next;
}

export function removeSearchHistory(query: string): string[] {
  const key = query.trim().toLowerCase();
  const next = key
    ? loadSearchHistory().filter((item) => item.toLowerCase() !== key)
    : loadSearchHistory();
  try {
    if (next.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
