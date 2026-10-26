/** Display nick for couple sync — local preference, mirrored into room/sync carefully. */
const KEY = "jte.display-nick";
const MAX = 8;

export function sanitizeNick(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX);
}

export function loadDisplayNick(): string {
  try {
    return sanitizeNick(localStorage.getItem(KEY) || "");
  } catch {
    return "";
  }
}

export function saveDisplayNick(nick: string): void {
  const next = sanitizeNick(nick);
  try {
    if (!next) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
}
