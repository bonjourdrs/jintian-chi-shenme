import type { ThemeId } from "../types.ts";
import type { DishKind, Motif } from "./visual.ts";
import dishCovers from "../data/dishCovers.json" with { type: "json" };

/** Base URL for public/ assets (works with Vite `base: "./"` + HashRouter). */
function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${path.replace(/^\//, "")}`;
}

/** Optional flag: set true after Codex PNGs are synced into public/assets/. */
export const ASSETS_READY = true;

const THEME_TEXTURE: Record<ThemeId, string> = {
  "cafe-journal": "cafe-paper.png",
  "kitchen-chalkboard": "chalk-board.png",
  "watercolor-market": "market-wash.png",
  "midnight-magazine": "midnight-paper.png",
};

const DISH_COVERS = dishCovers as Record<string, string>;

export type UiAssetName =
  | "couple"
  | "basket"
  | "die"
  | "empty-plate"
  | "app-icon"
  /* batch4 Codex — may 404 until CopyToBox */
  | "empty-tonight"
  | "empty-want"
  | "empty-search"
  | "empty-ledger"
  | "onboard-theme"
  | "onboard-find"
  | "onboard-couple"
  | "desk-ornament"
  | "splash-mark";

export type NavAssetName = "home" | "menu" | "shop" | "ledger" | "us";

export type EmptyKind = "tonight" | "want" | "search" | "ledger" | "default";

export function themeTexture(themeId: ThemeId): string {
  return publicUrl(`assets/themes/${THEME_TEXTURE[themeId]}`);
}

export function catIcon(motif: Motif): string {
  return publicUrl(`assets/cats/${motif}.png`);
}

export function kindArt(kind: DishKind): string {
  return publicUrl(`assets/kinds/${kind}.png`);
}

/**
 * Real Douyin / web dish photo when mapped in dishCovers.json; otherwise null
 * (caller falls back to kind Codex PNG, then SVG). Never uses Codex dish art.
 */
export function dishArt(name: string): string | null {
  const key = name.trim();
  if (!key) return null;
  const filename = DISH_COVERS[key];
  if (!filename) return null;
  return publicUrl(`assets/dishes/${filename}`);
}

export function uiAsset(name: UiAssetName): string {
  return publicUrl(`assets/ui/${name}.png`);
}

/** Codex nav marks under public/assets/nav/ — fall back to SVG Icons until copied. */
export function navAsset(name: NavAssetName): string {
  return publicUrl(`assets/nav/${name}.png`);
}

/** Prefer kind-specific empty art; callers should fall back to empty-plate on error. */
export function emptyAsset(kind: EmptyKind = "default"): string {
  if (kind === "tonight") return uiAsset("empty-tonight");
  if (kind === "want") return uiAsset("empty-want");
  if (kind === "search") return uiAsset("empty-search");
  if (kind === "ledger") return uiAsset("empty-ledger");
  return uiAsset("empty-plate");
}

/** CSS url(...) value for theme paper texture. */
export function themeTextureCss(themeId: ThemeId): string {
  return `url("${themeTexture(themeId)}")`;
}
