export type WantSortMode = "recent" | "custom" | "category" | "likes";

const KEY = "jte.want-sort";

export function loadWantSort(): WantSortMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "recent" || raw === "custom" || raw === "category" || raw === "likes") return raw;
  } catch {
    /* ignore */
  }
  return "recent";
}

export function saveWantSort(mode: WantSortMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}
