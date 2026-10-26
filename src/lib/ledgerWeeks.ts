/** Natural-week grouping for the couple ledger (Monday start, Asia/Shanghai box clock). */

export type LedgerLike = { updatedAt: number };

export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.getTime();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function shortMd(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

export function weekLabel(weekStart: number, now = Date.now()): string {
  const thisWeek = startOfWeek(now);
  const lastWeek = thisWeek - 7 * 24 * 60 * 60 * 1000;
  const end = weekStart + 6 * 24 * 60 * 60 * 1000;
  const range = `${shortMd(weekStart)} – ${shortMd(end)}`;
  if (weekStart === thisWeek) return `本周 · ${range}`;
  if (weekStart === lastWeek) return `上周 · ${range}`;
  const y = new Date(weekStart).getFullYear();
  const yNow = new Date(now).getFullYear();
  if (y !== yNow) {
    return `${y}/${range}`;
  }
  return range;
}

export function weekKind(weekStart: number, now = Date.now()): "this" | "last" | "older" {
  const thisWeek = startOfWeek(now);
  const lastWeek = thisWeek - 7 * 24 * 60 * 60 * 1000;
  if (weekStart === thisWeek) return "this";
  if (weekStart === lastWeek) return "last";
  return "older";
}

export type WeekGroup<T extends LedgerLike> = {
  weekStart: number;
  label: string;
  entries: T[];
};

export function groupByWeek<T extends LedgerLike>(entries: T[], now = Date.now()): WeekGroup<T>[] {
  const map = new Map<number, T[]>();
  for (const entry of entries) {
    const key = startOfWeek(entry.updatedAt);
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weekStart, items]) => ({
      weekStart,
      label: weekLabel(weekStart, now),
      entries: items,
    }));
}
