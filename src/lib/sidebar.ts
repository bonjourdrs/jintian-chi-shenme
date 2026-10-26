export type SideMode = "expanded" | "collapsed";

const MODE_KEY = "jte.sidebar-mode";
const WIDTH_KEY = "jte.sidebar-width";

export const SIDE_WIDTH_MIN = 148;
export const SIDE_WIDTH_MAX = 280;
export const SIDE_WIDTH_DEFAULT = 168;

export function loadSideMode(): SideMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "collapsed" || raw === "expanded") return raw;
  } catch {
    /* ignore */
  }
  return "expanded";
}

export function saveSideMode(mode: SideMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function clampSideWidth(px: number): number {
  if (!Number.isFinite(px)) return SIDE_WIDTH_DEFAULT;
  return Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, Math.round(px)));
}

export function loadSideWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw == null) return SIDE_WIDTH_DEFAULT;
    return clampSideWidth(Number(raw));
  } catch {
    /* ignore */
  }
  return SIDE_WIDTH_DEFAULT;
}

export function saveSideWidth(px: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(clampSideWidth(px)));
  } catch {
    /* ignore */
  }
}

export function applySideWidth(px: number): void {
  const w = clampSideWidth(px);
  try {
    document.documentElement.style.setProperty("--side-w", `${w}px`);
  } catch {
    /* ignore */
  }
}
