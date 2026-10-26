/** Want-list filter: only dishes not yet on tonight menu. Local preference. */
const KEY = "jte.want-not-tonight";

export function loadWantNotTonight(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function saveWantNotTonight(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
