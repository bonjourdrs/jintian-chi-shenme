/** Hide checked shopping items — local only. Default: show all. */
const KEY = "jte.shop-hide-bought";

export function loadHideBought(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function saveHideBought(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
