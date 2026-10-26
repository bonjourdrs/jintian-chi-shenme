/** Prefer fresh rolls — exclude tonight / recent. Local only, not couple-synced. */
const KEY = "jte.roll-exclude";

export function loadRollExclude(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true; /* default on */
}

export function saveRollExclude(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("jte-roll-exclude", { detail: { on } }));
  } catch {
    /* ignore */
  }
}
