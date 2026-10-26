/** Desktop (≥880) dish-grid gap: tight / standard / loose. Local-only. */
export type GridGapPref = "tight" | "standard" | "loose";

const KEY = "jte.grid-gap";

export function loadGridGap(): GridGapPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "tight" || raw === "standard" || raw === "loose") return raw;
  } catch {
    /* ignore */
  }
  return "standard";
}

export function saveGridGap(pref: GridGapPref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
}

export function applyGridGap(pref: GridGapPref): void {
  document.documentElement.dataset.gridGap = pref;
}
