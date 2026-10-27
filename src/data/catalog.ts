import { recipeFor, canonicalizeIngredientName } from "./recipes.ts";
import raw from "./seed.json" with { type: "json" };
import dishSources from "./dishSources.json" with { type: "json" };
import dishCovers from "./dishCovers.json" with { type: "json" };
import { mulberry32 } from "../lib/random.ts";
import type { Dish } from "../types.ts";

type SeedFile = {
  source: string;
  categories: string[];
  dishes: {
    id: string;
    name: string;
    category: string;
    videos?: { url: string; likes: string; title: string }[];
    likes_samples?: string[];
  }[];
};

const seed = raw as SeedFile;

export const SOURCE = seed.source;

export const dishes: Dish[] = seed.dishes.map((dish) => ({
  id: dish.id,
  name: dish.name,
  category: dish.category,
  videos: dish.videos ?? [],
  likesSamples: dish.likes_samples ?? [],
}));

export const dishById = new Map(dishes.map((dish) => [dish.id, dish]));

const DISH_SOURCES = dishSources as Record<string, string[]>;

export function sourcesOf(dish: Dish | string): string[] {
  const name = typeof dish === "string" ? dish : dish.name;
  return DISH_SOURCES[name] ?? [];
}

export type Motif = "home" | "meat" | "sea" | "veg" | "soup" | "cold" | "staple";

const META: Record<string, { short: string; motif: Motif; blurb: string }> = {
  家常热菜: { short: "家常", motif: "home", blurb: "下饭的那一口" },
  肉禽: { short: "肉禽", motif: "meat", blurb: "荤的担当" },
  海鲜: { short: "海鲜", motif: "sea", blurb: "鲜一下" },
  素菜: { short: "素菜", motif: "veg", blurb: "清清爽爽" },
  汤: { short: "汤", motif: "soup", blurb: "先喝一口" },
  凉菜: { short: "凉菜", motif: "cold", blurb: "开开胃" },
  主食: { short: "主食", motif: "staple", blurb: "吃饱的部分" },
};

export type CategoryInfo = {
  id: string;
  short: string;
  motif: Motif;
  blurb: string;
  count: number;
};

const counts = new Map<string, number>();
for (const dish of dishes) counts.set(dish.category, (counts.get(dish.category) ?? 0) + 1);

const orderedIds = [...seed.categories];
for (const dish of dishes) {
  if (!orderedIds.includes(dish.category)) orderedIds.push(dish.category);
}

export const categories: CategoryInfo[] = orderedIds.map((id) => {
  const meta = META[id] ?? { short: id.slice(0, 2), motif: "home" as Motif, blurb: "菜单里的一类" };
  return { id, ...meta, count: counts.get(id) ?? 0 };
});

export function dishesIn(category: string): Dish[] {
  return dishes.filter((dish) => dish.category === category);
}

let ingredientIndex: Map<string, string[]> | undefined;
export function searchDishes(query: string): Dish[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  ingredientIndex ??= new Map(dishes.map(dish => [dish.id, recipeFor(dish).ingredients.map(item => canonicalizeIngredientName(item.name).toLowerCase())]));
  return dishes.filter(dish => tokens.every(token => {
    const alias = canonicalizeIngredientName(token);
    return dish.name.toLowerCase().includes(token) || dish.category.includes(token) || ingredientIndex!.get(dish.id)!.some(name => name.includes(token) || name.includes(alias));
  })).sort((a, b) => Number(b.name.includes(query.trim())) - Number(a.name.includes(query.trim())));
}

export function likesOf(dish: Dish): { n: number; label: string } {
  let best = { n: 0, label: "" };
  for (const sample of dish.likesSamples) {
    const numeric = sample.includes("万") ? Number.parseFloat(sample) * 10000 : Number.parseFloat(sample);
    if (Number.isFinite(numeric) && numeric > best.n) best = { n: numeric, label: sample };
  }
  return best;
}

/** Compact likes for cards/detail: ≥1万 → N万 / N.N万; 0 → empty (no noise). */
export function formatLikesCompact(n: number, label = ""): string {
  const num = Number.isFinite(n) ? n : 0;
  if (num >= 10000) {
    const wan = num / 10000;
    const text =
      wan >= 100
        ? String(Math.round(wan))
        : (Math.round(wan * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return `${text}万`;
  }
  if (num > 0) return String(Math.round(num));
  const trimmed = (label || "").trim().replace(/赞$/u, "");
  if (!trimmed || trimmed === "0") return "";
  if (/万/u.test(trimmed)) return trimmed;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isFinite(parsed) && parsed > 0) return formatLikesCompact(parsed, "");
  return "";
}

export function videosOf(dish: Dish): Dish["videos"] {
  const seen = new Set<string>();
  const list: Dish["videos"] = [];
  for (const video of dish.videos) {
    if (!video.url || seen.has(video.url)) continue;
    seen.add(video.url);
    list.push(video);
  }
  return list;
}

export type DishSortMode = "default" | "hot" | "name";

export function sortDishes(list: Dish[], mode: DishSortMode): Dish[] {
  if (mode === "default") return list;
  const copy = [...list];
  if (mode === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  } else {
    // hot: 点赞高 — uses likes_samples (村驴 / 小不点子视频样例)
    copy.sort((a, b) => likesOf(b).n - likesOf(a).n || a.name.localeCompare(b.name, "zh"));
  }
  return copy;
}

export function featuredDishes(now = new Date()): Dish[] {
  const seedNumber = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const rand = mulberry32(seedNumber);
  const slots = [["肉禽", "家常热菜"], ["素菜", "海鲜"], ["汤"], ["主食"]];
  const picked: Dish[] = [];
  const used = new Set<string>();
  for (const group of slots) {
    const pool = dishes
      .filter((dish) => group.includes(dish.category) && !used.has(dish.id))
      .sort((a, b) => likesOf(b).n - likesOf(a).n)
      .slice(0, 12);
    if (pool.length === 0) continue;
    const dish = pool[Math.floor(rand() * pool.length)];
    if (!dish) continue;
    used.add(dish.id);
    picked.push(dish);
  }
  return picked;
}

export function parseLikesLabel(label: string): number {
  if (!label) return 0;
  if (label.includes("万")) return Number.parseFloat(label) * 10000;
  return Number.parseFloat(label) || 0;
}

export function awemeIdFromUrl(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

/** Cover path → creator: cunlv/… = 村驴, root aweme jpg = 小不点子, web/… = unknown */
const CREATOR_BY_AWEME = (() => {
  const map = new Map<string, string>();
  for (const filename of Object.values(dishCovers as Record<string, string>)) {
    if (filename.startsWith("cunlv/")) {
      const id = filename.slice("cunlv/".length).replace(/\.\w+$/, "");
      if (id) map.set(id, "村驴");
    } else if (!filename.includes("/")) {
      const id = filename.replace(/\.\w+$/, "");
      if (/^\d+$/.test(id)) map.set(id, "小不点子");
    }
  }
  return map;
})();

/** Best-effort creator label for a Douyin URL, falling back to dishSources. */
export function creatorOfVideo(url: string, dishName?: string): string {
  const id = awemeIdFromUrl(url);
  if (id) {
    const fromCover = CREATOR_BY_AWEME.get(id);
    if (fromCover) return fromCover;
  }
  const sources = dishName ? sourcesOf(dishName) : [];
  if (sources.length === 1) return sources[0] ?? "抖音";
  if (sources.includes("村驴") && !sources.includes("小不点子")) return "村驴";
  if (sources.includes("小不点子") && !sources.includes("村驴")) return "小不点子";
  return "抖音";
}

export function topVideosOf(dish: Dish, limit = 3): Dish["videos"] {
  return [...videosOf(dish)]
    .sort((a, b) => parseLikesLabel(b.likes) - parseLikesLabel(a.likes))
    .slice(0, limit);
}
