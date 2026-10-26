/** Prefer screen wake lock while cooking — local only. */
const KEY = "jte.cook-wake";

export function loadCookWake(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveCookWake(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isWakeLockSupported(): boolean {
  try {
    return Boolean((navigator as Navigator & { wakeLock?: unknown }).wakeLock);
  } catch {
    return false;
  }
}
