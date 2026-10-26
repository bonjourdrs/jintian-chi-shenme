/** First-run onboarding sheet. Persisted after done/skip; replay via event. */
const KEY = "jte.onboard.v1";
export const ONBOARD_REPLAY_EVENT = "jte-onboard-replay";

export function isOnboardDone(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardDone(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Clear done flag and ask OnboardSheet to open (user-initiated only). */
export function replayOnboard(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(ONBOARD_REPLAY_EVENT));
}
