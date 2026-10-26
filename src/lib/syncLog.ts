/** Local-only couple sync activity log (cap 10). Not synced. */
export type SyncLogKind = "push" | "pull" | "conflict-local" | "conflict-remote" | "pack";

export type SyncLogEntry = {
  id: string;
  at: number;
  kind: SyncLogKind;
  detail?: string;
};

const KEY = "jte.sync-log.v1";
const CAP = 10;

export function loadSyncLog(): SyncLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SyncLogEntry => {
        if (!item || typeof item !== "object") return false;
        const row = item as SyncLogEntry;
        return (
          typeof row.id === "string" &&
          typeof row.at === "number" &&
          (row.kind === "push" ||
            row.kind === "pull" ||
            row.kind === "conflict-local" ||
            row.kind === "conflict-remote" ||
            row.kind === "pack")
        );
      })
      .slice(0, CAP);
  } catch {
    return [];
  }
}

export function pushSyncLog(kind: SyncLogKind, detail?: string): SyncLogEntry[] {
  const entry: SyncLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    kind,
    detail: detail?.trim() || undefined,
  };
  const next = [entry, ...loadSyncLog()].slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new CustomEvent("jte-sync-log", { detail: { entry } }));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearSyncLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("jte-sync-log", { detail: { cleared: true } }));
  } catch {
    /* ignore */
  }
}

export function syncLogLabel(kind: SyncLogKind): string {
  switch (kind) {
    case "push":
      return "推送";
    case "pull":
      return "拉取";
    case "conflict-local":
      return "冲突·留本机";
    case "conflict-remote":
      return "冲突·用对方";
    case "pack":
      return "同步包";
    default:
      return "同步";
  }
}

/** Relative time in Asia/Shanghai wall clock for display context. */
export function formatSyncLogWhen(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  if (diff < 45_000) return "刚刚";
  if (diff < 60_000 * 60) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 60_000 * 60 * 24) return `${Math.floor(diff / (60_000 * 60))} 小时前`;
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(at));
  } catch {
    return new Date(at).toLocaleString("zh-CN");
  }
}
