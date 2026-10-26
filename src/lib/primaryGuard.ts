/** Ignore double-fires on primary actions within a short window. */
const lastAt = new Map<string, number>();

/** @returns true if this call should run (first press / after cooldown). */
export function oncePrimary(key: string, ms = 400): boolean {
  const now = Date.now();
  const prev = lastAt.get(key) ?? 0;
  if (now - prev < ms) return false;
  lastAt.set(key, now);
  return true;
}
