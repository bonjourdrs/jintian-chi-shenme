export type CookSession = {
  cookStep: number;
  timerEndsAt: number | null;
  timerPausedLeft: number | null;
  timerInitialSecs: number;
  timerStepIndex: number | null;
  timerStepLabel: string;
  timerPresetMin: number | null;
  savedAt: number;
};
const key = (id: string) => `jte.cook.session.${id}`;
export function loadCookSession(id: string): CookSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(id)) || "null");
    if (
      !value ||
      !Number.isInteger(value.cookStep) ||
      value.cookStep < 0 ||
      !Number.isFinite(value.savedAt) ||
      Date.now() - value.savedAt > 24 * 60 * 60 * 1000
    )
      return null;
    for (const field of [
      "timerEndsAt",
      "timerPausedLeft",
      "timerInitialSecs",
      "timerStepIndex",
      "timerPresetMin",
    ])
      if (
        value[field] !== null &&
        (!Number.isFinite(value[field]) || value[field] < 0)
      )
        return null;
    return value;
  } catch {
    return null;
  }
}
export function saveCookSession(id: string, session: CookSession): void {
  localStorage.setItem(key(id), JSON.stringify(session));
}
export function clearCookSession(id: string): void {
  localStorage.removeItem(key(id));
}
