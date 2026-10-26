export type ListDensity = "comfort" | "compact";

const KEY = "jte.list-density";

export function loadDensity(): ListDensity {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "compact" || raw === "comfort") return raw;
  } catch {
    /* ignore */
  }
  return "comfort";
}

export function saveDensity(density: ListDensity): void {
  try {
    localStorage.setItem(KEY, density);
  } catch {
    /* ignore */
  }
}

export function applyDensity(density: ListDensity): void {
  document.documentElement.dataset.density = density;
}
