/** Recently viewed dishes — local ring buffer, not part of couple-synced AppState. */

export type RecentDish = {
  id: string;
  name: string;
  at: number;
};

const KEY = "jte.recent";
const MAX = 12;

function isRecent(value: unknown): value is RecentDish {
  if (!value || typeof value !== "object") return false;
  const item = value as RecentDish;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.name === "string" &&
    item.name.length > 0 &&
    typeof item.at === "number"
  );
}

export function loadRecent(): RecentDish[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecent).slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecent(id: string, name: string): RecentDish[] {
  const next: RecentDish[] = [
    { id, name, at: Date.now() },
    ...loadRecent().filter((item) => item.id !== id),
  ].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
