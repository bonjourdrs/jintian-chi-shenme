import { isPurchased } from "./purchaseTokens.ts";
import { ledgerIngredients, ingredientRole } from "./ledgerIngredients.ts";
export { splitIngredientText } from "./ledgerIngredients.ts";
import {
  amountDisplay,
  formatIngredientCopyLine,
  mergeAmounts,
  splitIngredientLabel,
  type ParsedAmount,
} from "./amounts.ts";
export {
  amountDisplay,
  formatIngredientCopyLine,
  splitIngredientLabel,
} from "./amounts.ts";
import {
  canonicalizeIngredientName,
  ingredientNote,
  recipeFor,
} from "../data/recipes.ts";
import { hemaSearchAppendix } from "./hema.ts";
import {
  baseServings,
  loadServingsForDish,
  scaleAmountText,
} from "./servings.ts";
import type { Dish, ExtraItem, Ingredient, LedgerEntry } from "../types.ts";

export type ShopItem = {
  name: string;
  amount: string;
  role: "main" | "seasoning";
  detail: string;
  bought: boolean;
  extraId?: string;
  extraItems?: { id: string; name: string }[];
  unknownCount?: number;
  /** How many menu dishes / ledger / extras this line was merged from */
  sourceCount: number;
};

export type MenuSource = {
  key: string;
  name: string;
  kind: "dish" | "ledger";
};

export type ShoppingList = {
  foods: ShopItem[];
  seasonings: ShopItem[];
  unparsed: string[];
  sources: MenuSource[];
  /** True when any dish used a non-base servings scale from detail memory */
  servingsScaled?: boolean;
};

export function pantryKey(dishId: string, name: string): string {
  return `${dishId}@@${name}`;
}

export function buildShopping(input: {
  dishes: Dish[];
  ledger: LedgerEntry[];
  ledgerIds: string[];
  extras: ExtraItem[];
  bought: string[];
}): ShoppingList {
  const map = new Map<
    string,
    {
      name: string;
      role: "main" | "seasoning";
      uncertain: boolean;
      sources: string[];
      extraId?: string;
      onlyExtra: boolean;
      extraItems: { id: string; name: string }[];
      amounts: ParsedAmount[];
    }
  >();

  const add = (
    name: string,
    role: "main" | "seasoning",
    uncertain: boolean,
    source: string,
    extraId?: string,
  ) => {
    const display = name.trim();
    if (!display) return;
    const { base, amount } = splitIngredientLabel(display);
    const key = canonicalizeIngredientName(base) || base;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        name: key,
        role,
        uncertain,
        sources: source ? [source] : [],
        extraId,
        onlyExtra: Boolean(extraId),
        amounts: [amount],
        extraItems: extraId ? [{ id: extraId, name: display }] : [],
      });
      return;
    }
    if (prev.role === "seasoning" && role === "main") prev.role = "main";
    if (!uncertain) prev.uncertain = false;
    if (source && !prev.sources.includes(source)) prev.sources.push(source);
    if (!extraId) prev.onlyExtra = false;
    prev.amounts.push(amount);
    if (extraId) prev.extraItems.push({ id: extraId, name: display });
    // Prefer shorter canonical / plainer label when merging
    if (key.length < prev.name.length) prev.name = key;
  };

  const unparsed: string[] = [];
  const sources: MenuSource[] = [];

  let servingsScaled = false;
  for (const dish of input.dishes) {
    sources.push({ key: `dish:${dish.id}`, name: dish.name, kind: "dish" });
    const recipe = recipeFor(dish);
    if (recipe.unparsed) {
      unparsed.push(dish.name);
      continue;
    }
    const servings = loadServingsForDish(dish.id);
    if (servings !== baseServings()) servingsScaled = true;
    for (const ingredient of recipe.ingredients) {
      const labeled = scaleAmountText(ingredient.name, servings);
      add(labeled, ingredient.role, ingredient.uncertain, dish.name);
    }
  }

  for (const id of input.ledgerIds) {
    const entry = input.ledger.find((item) => item.id === id);
    if (!entry) continue;
    sources.push({
      key: `ledger:${entry.id}`,
      name: entry.name,
      kind: "ledger",
    });
    const ingredients = ledgerIngredients(entry);
    if (ingredients.length === 0) unparsed.push(entry.name);
    if (loadServingsForDish(`ledger:${entry.id}`) !== (entry.baseServings ?? 2))
      servingsScaled = true;
    for (const item of ingredients)
      add(item.name, item.role, item.uncertain, entry.name);
  }

  for (const extra of input.extras)
    add(
      extra.name,
      ingredientRole(extra.name),
      false,
      "临时 · 仅本机",
      extra.id,
    );

  const foods: ShopItem[] = [];
  const seasonings: ShopItem[] = [];
  for (const item of map.values()) {
    let detail = "份量待完善";
    if (item.role === "seasoning") {
      detail =
        item.sources.length > 2
          ? "好几道菜都会用到 · 估算 · 待完善"
          : `${item.sources.join(" · ") || "估算"} · 待完善`;
    } else if (item.uncertain) {
      detail = `${item.sources.join(" · ")} · 待完善`;
    } else if (item.sources.length > 0) {
      detail = `${item.sources.join(" · ")} · 份量待完善`;
    }
    const unknownCount = item.amounts.filter(
      (amount) => amount.qty === null,
    ).length;
    const knownAmount = mergeAmounts(item.amounts);
    const partial =
      item.amounts.some((amount) => amount.qty !== null) && unknownCount > 0;
    const shop: ShopItem = {
      name: item.name,
      amount: partial
        ? `${knownAmount}${knownAmount ? " + " : ""}${unknownCount} 项用量待定`
        : knownAmount,
      unknownCount,
      extraItems: item.extraItems,
      role: item.role,
      detail,
      bought: false,
      extraId: item.onlyExtra ? item.extraId : undefined,
      sourceCount: Math.max(1, item.sources.length),
    };
    shop.bought = isPurchased(shop, input.bought);
    if (shop.amount) shop.detail = item.sources.join(" · ");
    if (item.role === "seasoning") seasonings.push(shop);
    else foods.push(shop);
  }

  return { foods, seasonings, unparsed, sources, servingsScaled };
}

export type ShopDishGroup = {
  key: string;
  name: string;
  kind: "dish" | "ledger" | "extra";
  items: ShopItem[];
};

/** Per-dish / ledger sections (ingredients may repeat across groups). Checks still keyed by name. */
export function buildShoppingByDish(input: {
  dishes: Dish[];
  ledger: LedgerEntry[];
  ledgerIds: string[];
  extras: ExtraItem[];
  bought: string[];
}): { groups: ShopDishGroup[]; unparsed: string[]; sources: MenuSource[] } {
  const merged = buildShopping(input);
  const bought = new Set(
    [...merged.foods, ...merged.seasonings]
      .filter((item) => item.bought)
      .map((item) => item.name),
  );
  const groups: ShopDishGroup[] = [];
  const unparsed: string[] = [];
  const sources: MenuSource[] = [];

  const toItem = (
    name: string,
    role: "main" | "seasoning",
    uncertain: boolean,
    source: string,
    extraId?: string,
  ): ShopItem => {
    const { base, amount } = splitIngredientLabel(name);
    const key = canonicalizeIngredientName(base) || base;
    let detail = "份量待完善";
    if (role === "seasoning") detail = `${source} · 待完善`;
    else if (uncertain) detail = `${source} · 待完善`;
    else detail = `${source} · 份量待完善`;
    return {
      name: key,
      amount: amountDisplay(amount),
      role,
      detail: amountDisplay(amount) ? source : detail,
      bought: bought.has(key),
      extraId,
      sourceCount: 1,
      extraItems: extraId ? [{ id: extraId, name }] : [],
    };
  };

  for (const dish of input.dishes) {
    sources.push({ key: `dish:${dish.id}`, name: dish.name, kind: "dish" });
    const recipe = recipeFor(dish);
    if (recipe.unparsed) {
      unparsed.push(dish.name);
      groups.push({
        key: `dish:${dish.id}`,
        name: dish.name,
        kind: "dish",
        items: [],
      });
      continue;
    }
    const servings = loadServingsForDish(dish.id);
    const items: ShopItem[] = [];
    for (const ingredient of recipe.ingredients) {
      const labeled = scaleAmountText(ingredient.name, servings);
      const item = toItem(
        labeled,
        ingredient.role,
        ingredient.uncertain,
        dish.name,
      );
      if (servings !== baseServings()) {
        item.detail = `${item.detail} · 按 ${servings} 人`;
      }
      items.push(item);
    }
    groups.push({
      key: `dish:${dish.id}`,
      name: dish.name,
      kind: "dish",
      items,
    });
  }

  for (const id of input.ledgerIds) {
    const entry = input.ledger.find((item) => item.id === id);
    if (!entry) continue;
    sources.push({
      key: `ledger:${entry.id}`,
      name: entry.name,
      kind: "ledger",
    });
    const lines = ledgerIngredients(entry);
    if (lines.length === 0) {
      unparsed.push(entry.name);
      groups.push({
        key: `ledger:${entry.id}`,
        name: entry.name,
        kind: "ledger",
        items: [],
      });
      continue;
    }
    groups.push({
      key: `ledger:${entry.id}`,
      name: entry.name,
      kind: "ledger",
      items: lines.map((item) =>
        toItem(item.name, item.role, item.uncertain, entry.name),
      ),
    });
  }

  if (input.extras.length > 0) {
    groups.push({
      key: "extra:hand",
      name: "临时 · 仅本机",
      kind: "extra",
      items: input.extras.map((extra) =>
        toItem(
          extra.name,
          ingredientRole(extra.name),
          false,
          "临时 · 仅本机",
          extra.id,
        ),
      ),
    });
  }

  return { groups, unparsed, sources };
}

export function shoppingText(
  list: ShoppingList,
  when: Date = new Date(),
  opts?: { includeHema?: boolean; uncheckedOnly?: boolean },
): string {
  const day = `${when.getMonth() + 1}月${when.getDate()}日`;
  const onlyOpen = Boolean(opts?.uncheckedOnly);
  const foods = onlyOpen
    ? list.foods.filter((item) => !item.bought)
    : list.foods;
  const seasonings = onlyOpen
    ? list.seasonings.filter((item) => !item.bought)
    : list.seasonings;
  const line = (item: ShopItem) => {
    const body = formatIngredientCopyLine(
      item.name,
      item.amount || (item.role === "seasoning" ? "适量" : ""),
    );
    return !onlyOpen && item.bought ? `${body}（已买）` : body;
  };
  const blocks: string[] = [
    onlyOpen ? `今晚采购 · 未勾选 · ${day}` : `今晚采购 · ${day}`,
  ];
  if (foods.length > 0) blocks.push("", "食材", ...foods.map(line));
  if (seasonings.length > 0) blocks.push("", "调味", ...seasonings.map(line));
  if (!onlyOpen && list.unparsed.length > 0) {
    blocks.push("", `主料待完善：${list.unparsed.join("、")}`);
  }
  if (foods.length === 0 && seasonings.length === 0) {
    blocks.push("", onlyOpen ? "没有未勾选的食材。" : "清单是空的。");
  } else {
    blocks.push("", "份量供参考，下单前再看一眼。");
  }
  if (opts?.includeHema !== false) {
    const unchecked = [...foods, ...seasonings]
      .filter((item) => !item.bought)
      .map((item) => item.name);
    const hema = hemaSearchAppendix(unchecked);
    if (hema) blocks.push("", hema);
  }
  return blocks.join(String.fromCharCode(10));
}

export function uncheckedCount(list: ShoppingList): number {
  return [...list.foods, ...list.seasonings].filter((item) => !item.bought)
    .length;
}

/* —— Merge shopping list (tonight) —— */

export type MergedShopLine = {
  name: string;
  amount: string;
  role: "main" | "seasoning";
  sources: string[];
  merged: boolean;
};

/**
 * Merge tonight ingredients by canonical name.
 * Parseable same-unit amounts are summed; otherwise amounts are listed side by side.
 */
export function mergeTonightIngredients(
  items: { name: string; ingredients: Ingredient[] }[],
): MergedShopLine[] {
  type Acc = {
    name: string;
    role: "main" | "seasoning";
    sources: string[];
    amounts: ParsedAmount[];
    notes: string[];
    count: number;
  };
  const map = new Map<string, Acc>();

  for (const item of items) {
    for (const ing of item.ingredients) {
      const display = ing.name.trim();
      if (!display) continue;
      const { base, amount } = splitIngredientLabel(display);
      const key =
        canonicalizeIngredientName(base || display) || base || display;
      const note = ingredientNote(ing);
      const hasInline = Boolean(
        amount.qty != null || amount.qual || amount.raw,
      );
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          name: key,
          role: ing.role,
          sources: item.name ? [item.name] : [],
          amounts: hasInline ? [amount] : [],
          notes: hasInline ? [] : note ? [note] : [],
          count: 1,
        });
        continue;
      }
      prev.count += 1;
      if (prev.role === "seasoning" && ing.role === "main") prev.role = "main";
      if (item.name && !prev.sources.includes(item.name))
        prev.sources.push(item.name);
      if (hasInline) prev.amounts.push(amount);
      else if (note && !prev.notes.includes(note)) prev.notes.push(note);
    }
  }

  const lines: MergedShopLine[] = [];
  for (const acc of map.values()) {
    let amount = mergeAmounts(acc.amounts);
    if (amount && acc.notes.length)
      amount += ` + ${acc.count - acc.amounts.length} 项用量待定`;
    if (!amount && acc.notes.length) {
      // Deduplicate qualitative notes; if many dishes share 适量, say Nx
      const uniq = [...new Set(acc.notes)];
      if (
        uniq.length === 1 &&
        acc.count > 1 &&
        /适量|少许|两人份/.test(uniq[0])
      ) {
        amount = `${uniq[0]} ×${acc.count}`;
      } else if (uniq.length === 1) {
        amount = uniq[0];
      } else {
        amount = uniq.join("、");
      }
    }
    lines.push({
      name: acc.name,
      amount,
      role: acc.role,
      sources: acc.sources,
      merged: acc.count > 1 || acc.amounts.length > 1,
    });
  }

  lines.sort((a, b) => {
    if (a.role !== b.role) return a.role === "main" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh");
  });
  return lines;
}

export function mergedShoppingPlainText(
  lines: MergedShopLine[],
  when = new Date(),
): string {
  const day = `${when.getMonth() + 1}月${when.getDate()}日`;
  const mains = lines.filter((l) => l.role === "main");
  const seas = lines.filter((l) => l.role === "seasoning");
  const blocks = [`合并购物清单 · ${day}`];
  const fmt = (l: MergedShopLine) =>
    l.amount ? `${l.name} ${l.amount}` : l.name;
  if (mains.length) blocks.push("", "食材", ...mains.map(fmt));
  if (seas.length) blocks.push("", "调味", ...seas.map(fmt));
  blocks.push("", "同名已合并；能解析的用量已相加，否则并列写出。");
  return blocks.join("\n");
}
