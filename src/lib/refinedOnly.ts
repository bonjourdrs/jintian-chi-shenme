/** Browse filter: show only dishes with refined recipes. Local preference. */
const KEY = "jte.refined-only";

export function loadRefinedOnly(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function saveRefinedOnly(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
