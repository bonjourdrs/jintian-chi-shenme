/** Desktop dish-grid column preference (≥880). Local only. */
export type GridColsPref = "auto" | "2" | "3" | "4";

const KEY = "jte.grid-cols";

export function loadGridCols(): GridColsPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "auto" || raw === "2" || raw === "3" || raw === "4") return raw;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function saveGridCols(pref: GridColsPref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
}

export function applyGridCols(pref: GridColsPref): void {
  document.documentElement.dataset.gridCols = pref;
}
