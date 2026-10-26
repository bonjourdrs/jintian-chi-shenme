/** Optional short chime when cook timer hits 0 — local preference. */

import { loadHapticsEnabled } from "./haptics.ts";

const KEY = "jte.timer-chime";

/** Independent pref; default ON. Master「触感反馈」off silences chime too. */
export function loadTimerChime(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveTimerChime(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Soft two-tone ping — no external asset. Respects master haptics switch. */
export function playTimerChime(): void {
  try {
    if (!loadHapticsEnabled()) return;
    if (!loadTimerChime()) return;
    const ac = ctx();
    if (!ac) return;
    void ac.resume?.();
    const now = ac.currentTime;
    const beep = (freq: number, start: number, dur: number, gain = 0.08) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    beep(880, now, 0.12, 0.09);
    beep(1174, now + 0.14, 0.16, 0.07);
  } catch {
    /* autoplay / unsupported — ignore */
  }
}
