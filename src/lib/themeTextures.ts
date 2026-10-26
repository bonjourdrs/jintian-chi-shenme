import type { ThemeId } from "../types.ts";
import { themeTexture } from "./assets.ts";

const THEME_IDS: ThemeId[] = [
  "cafe-journal",
  "kitchen-chalkboard",
  "watercolor-market",
  "midnight-magazine",
];

const ready = new Set<string>();
let bootStarted = false;

function loadOne(url: string): Promise<void> {
  if (ready.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const done = () => {
      ready.add(url);
      resolve();
    };
    img.onload = () => {
      if (typeof img.decode === "function") {
        void img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = done;
    img.src = url;
  });
}

/** Warm all four paper textures so theme switches don't FOUC. */
export function preloadThemeTextures(): void {
  if (bootStarted) return;
  bootStarted = true;
  for (const id of THEME_IDS) {
    void loadOne(themeTexture(id));
  }
}

/** Ensure one theme's texture is decoded before applying (crossfade stays smooth). */
export async function ensureThemeTexture(themeId: ThemeId): Promise<void> {
  await loadOne(themeTexture(themeId));
}

export function themeTextureReady(themeId: ThemeId): boolean {
  return ready.has(themeTexture(themeId));
}
