import { isOnline } from "./online.ts";

const QUIET_AFTER = 3;
let fails = 0;
let bannerSent = false;

export function noteCoverFail(): void {
  fails += 1;
  if (fails < QUIET_AFTER) return;
  if (bannerSent) return;
  if (isOnline()) return;
  bannerSent = true;
  try {
    window.dispatchEvent(
      new CustomEvent("jte-cover-fail-flood", { detail: { count: fails } }),
    );
  } catch {
    /* ignore */
  }
}

export function noteCoverOk(): void {
  /* successful loads don't reset flood mid-session — keeps banner quiet */
}

/** When many covers fail offline, hide noisy per-card「点按重试」labels. */
export function quietCoverRetryLabels(): boolean {
  return fails >= QUIET_AFTER && !isOnline();
}

export function resetCoverFailSession(): void {
  fails = 0;
  bannerSent = false;
}
