/** Short haptic tap when the platform supports Vibration API; no-op otherwise. */

const PREF_KEY = "jte.haptics";

let lastTapAt = 0;
const TAP_GAP_MS = 90;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Local-only master switch. Default ON. */
export function loadHapticsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function hapticsAllowed(): boolean {
  if (!loadHapticsEnabled()) return false;
  if (prefersReducedMotion()) return false;
  return true;
}

export function hapticTap(ms = 12): void {
  try {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;
    if (!hapticsAllowed()) return;
    const now = Date.now();
    if (now - lastTapAt < TAP_GAP_MS) return;
    lastTapAt = now;
    navigator.vibrate(Math.max(10, Math.min(15, ms)));
  } catch {
    /* unsupported / blocked — ignore */
  }
}

/** Stronger pulse for timer / alarm completion. */
export function hapticAlarm(): void {
  try {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;
    if (!hapticsAllowed()) return;
    navigator.vibrate([180, 70, 180, 70, 320]);
  } catch {
    /* unsupported / blocked — ignore */
  }
}
