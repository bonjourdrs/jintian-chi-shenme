/** Optional cook-step speech — local only, default off. */
const KEY = "jte.cook-speak";

export function loadCookSpeak(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function saveCookSpeak(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

/** Speak one cook step in zh-CN if available. No-op if unsupported. */
export function speakCookStep(text: string): boolean {
  if (!canSpeak()) return false;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "zh-CN";
    u.rate = 1;
    /* Prefer a Chinese voice when listed */
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find((v) => /zh(-|_|$)|chinese|中文/i.test(`${v.lang} ${v.name}`));
    if (zh) u.voice = zh;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopCookSpeak(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
