/** Optional theme-switch visual pulse — local only, OFF by default. */
const KEY = "jte.theme-pulse";

export function loadThemePulse(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function saveThemePulse(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
