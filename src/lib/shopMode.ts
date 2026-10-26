export type ShopGroupMode = "merged" | "by-dish";

const KEY = "jte.shop-group-mode";

export function loadShopGroupMode(): ShopGroupMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "by-dish" || raw === "merged") return raw;
  } catch {
    /* ignore */
  }
  return "merged";
}

export function saveShopGroupMode(mode: ShopGroupMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}
