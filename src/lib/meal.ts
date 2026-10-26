import type { CategoryId, Dish, MealConfig } from "../types.ts";

export const CATEGORY_IDS: CategoryId[] = [
  "家常热菜",
  "肉禽",
  "海鲜",
  "素菜",
  "汤",
  "凉菜",
  "主食",
];

const SHORT: Record<CategoryId, string> = {
  家常热菜: "家常",
  肉禽: "肉禽",
  海鲜: "海鲜",
  素菜: "素菜",
  汤: "汤",
  凉菜: "凉菜",
  主食: "主食",
};

export const DEFAULT_MEAL: MealConfig = {
  家常热菜: 0,
  肉禽: 1,
  海鲜: 0,
  素菜: 1,
  汤: 1,
  凉菜: 0,
  主食: 1,
};

export const MEAL_PRESETS: { id: string; name: string; desc: string; meal: MealConfig }[] = [
  {
    id: "one-soup",
    name: "一菜一汤",
    desc: "一道热菜 + 一碗汤，轻便",
    meal: { 家常热菜: 1, 肉禽: 0, 海鲜: 0, 素菜: 0, 汤: 1, 凉菜: 0, 主食: 0 },
  },
  {
    id: "classic",
    name: "两菜一汤",
    desc: "两道热菜，加一碗汤",
    meal: { 家常热菜: 1, 肉禽: 1, 海鲜: 0, 素菜: 0, 汤: 1, 凉菜: 0, 主食: 0 },
  },
  {
    id: "three-soup",
    name: "三菜一汤",
    desc: "三道热菜，加一碗汤",
    meal: { 家常热菜: 1, 肉禽: 1, 海鲜: 0, 素菜: 1, 汤: 1, 凉菜: 0, 主食: 0 },
  },
  {
    id: "simple",
    name: "两人简餐",
    desc: "一荤一素，一汤，一主食",
    meal: { 家常热菜: 0, 肉禽: 1, 海鲜: 0, 素菜: 1, 汤: 1, 凉菜: 0, 主食: 1 },
  },
  {
    id: "feast",
    name: "周末丰盛",
    desc: "荤素海鲜，凉菜汤主食",
    meal: { 家常热菜: 1, 肉禽: 1, 海鲜: 1, 素菜: 1, 汤: 1, 凉菜: 1, 主食: 1 },
  },
];

export function sanitizeMeal(input: unknown): MealConfig {
  const meal: MealConfig = { ...DEFAULT_MEAL };
  if (!input || typeof input !== "object") return meal;
  const source = input as Record<string, unknown>;
  let seen = false;
  for (const id of CATEGORY_IDS) {
    if (id in source) seen = true;
    const value = source[id];
    if (typeof value === "number" && Number.isFinite(value)) {
      meal[id] = Math.max(0, Math.min(4, Math.round(value)));
    }
  }
  return seen ? meal : { ...DEFAULT_MEAL };
}

export function mealSummary(meal: MealConfig): string {
  const parts = CATEGORY_IDS.filter((id) => meal[id] > 0).map((id) => `${SHORT[id]} ${meal[id]}`);
  return parts.length > 0 ? parts.join(" · ") : "还没选";
}

export function mealTotal(meal: MealConfig): number {
  return CATEGORY_IDS.reduce((sum, id) => sum + meal[id], 0);
}

export function sameMeal(a: MealConfig, b: MealConfig): boolean {
  return CATEGORY_IDS.every((id) => a[id] === b[id]);
}

export function categoryShort(id: string): string {
  if (id in SHORT) return SHORT[id as CategoryId];
  return id;
}

/** Prefer dishes with a real recipe override or parseable ingredients over empty shells. */
export type RecipeQuality = "rich" | "ok" | "empty";

export type RollMealResult = { dishes: Dish[]; relaxed: boolean };

export function rollMeal(
  meal: MealConfig,
  all: Dish[],
  rand: () => number = Math.random,
  quality?: (dish: Dish) => RecipeQuality,
  /** Soft-exclude (tonight / recent / just-rolled). Relaxes per category if pool too small. */
  softExclude?: ReadonlySet<string>,
): RollMealResult {
  const picked: Dish[] = [];
  const used = new Set<string>();
  let relaxed = false;
  const weightOf = (dish: Dish): number => {
    const q = quality?.(dish) ?? "ok";
    if (q === "rich") return 9;
    if (q === "ok") return 2;
    return 1;
  };
  const pickWeighted = (pool: Dish[]): Dish | undefined => {
    if (pool.length === 0) return undefined;
    if (!quality) {
      const choice = Math.floor(rand() * pool.length);
      return pool.splice(choice, 1)[0];
    }
    let total = 0;
    const weights = pool.map((dish) => {
      const w = weightOf(dish);
      total += w;
      return w;
    });
    let ticket = rand() * total;
    let index = 0;
    for (; index < pool.length; index += 1) {
      ticket -= weights[index] ?? 1;
      if (ticket <= 0) break;
    }
    if (index >= pool.length) index = pool.length - 1;
    return pool.splice(index, 1)[0];
  };
  for (const id of CATEGORY_IDS) {
    const count = meal[id];
    if (count <= 0) continue;
    let pool = all.filter(
      (dish) => dish.category === id && !used.has(dish.id) && !(softExclude?.has(dish.id) ?? false),
    );
    // Soft exclude: if too few left in this category, allow excluded dishes back in.
    if (pool.length < count) {
      if (softExclude && softExclude.size > 0) relaxed = true;
      pool = all.filter((dish) => dish.category === id && !used.has(dish.id));
    }
    for (let index = 0; index < count && pool.length > 0; index += 1) {
      const dish = pickWeighted(pool);
      if (!dish) break;
      used.add(dish.id);
      picked.push(dish);
    }
  }
  return { dishes: picked, relaxed };
}

/** Live compare tonight dish count vs configured meal total — soft guidance only. */
export function menuVsMealHint(menuCount: number, meal: MealConfig): string | null {
  const target = mealTotal(meal);
  if (target <= 0) return "还没定几菜几汤，点上面可改。";
  if (menuCount === 0) return null;
  if (menuCount < target) return `比搭配少 ${target - menuCount} 道，可以再加或改搭配。`;
  if (menuCount > target) return `比搭配多 ${menuCount - target} 道，两人可能吃不完，没关系。`;
  return "刚好对准今晚搭配。";
}

export type MealProgressPart = {
  id: CategoryId | "ledger";
  short: string;
  have: number;
  want: number;
  /** under | ok | over */
  tone: "under" | "ok" | "over";
};

/** Glanceable tonight vs target composition (categories with target > 0, plus leftover menu cats). */
export function mealProgressParts(
  menuDishes: { category: string }[],
  meal: MealConfig,
  ledgerCount = 0,
): MealProgressPart[] {
  const haveBy = new Map<string, number>();
  for (const dish of menuDishes) {
    haveBy.set(dish.category, (haveBy.get(dish.category) ?? 0) + 1);
  }
  const parts: MealProgressPart[] = [];
  for (const id of CATEGORY_IDS) {
    const want = meal[id];
    const have = haveBy.get(id) ?? 0;
    if (want <= 0 && have <= 0) continue;
    const tone = have < want ? "under" : have > want ? "over" : "ok";
    parts.push({ id, short: SHORT[id], have, want, tone });
  }
  if (ledgerCount > 0) {
    parts.push({
      id: "ledger",
      short: "账本",
      have: ledgerCount,
      want: 0,
      tone: "ok",
    });
  }
  return parts;
}

