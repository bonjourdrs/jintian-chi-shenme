/** Collapsed/expanded state for Us → 偏好 groups. Local-only. */
export type PrefFoldId = "feel" | "layout";

const KEY = "jte.pref-folds";

/** Default: common groups open. */
const DEFAULTS: Record<PrefFoldId, boolean> = {
  feel: true,
  layout: true,
};

type FoldMap = Partial<Record<PrefFoldId, boolean>>;

function read(): FoldMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FoldMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadPrefFold(id: PrefFoldId): boolean {
  const map = read();
  if (typeof map[id] === "boolean") return map[id]!;
  return DEFAULTS[id];
}

export function savePrefFold(id: PrefFoldId, open: boolean): void {
  try {
    const map = { ...read(), [id]: open };
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
