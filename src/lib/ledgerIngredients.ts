import type { Ingredient, LedgerEntry } from "../types.ts";
import { canonicalizeIngredientName } from "../data/recipes.ts";
import { splitIngredientLabel } from "./amounts.ts";
import { loadServingsForDish, scaleAmountText } from "./servings.ts";
export function splitIngredientText(text: string): string[] {
  return text
    .split(/[\n,，、;；]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
const SEASONINGS = new Set([
  "盐",
  "白糖",
  "冰糖",
  "生抽",
  "老抽",
  "料酒",
  "食用油",
  "香油",
  "蚝油",
  "淀粉",
  "鸡精",
  "味精",
  "香醋",
  "白醋",
  "豆瓣酱",
  "胡椒粉",
  "花椒",
  "干辣椒",
  "姜",
  "大蒜",
  "小葱",
  "蜂蜜",
  "番茄酱",
  "黄油",
  "孜然",
  "咖喱",
]);
export function ingredientRole(label: string): Ingredient["role"] {
  const key = canonicalizeIngredientName(splitIngredientLabel(label).base);
  return SEASONINGS.has(key) ? "seasoning" : "main";
}
export function ledgerServingsKey(id: string): string {
  return `ledger:${id}`;
}
export function ledgerIngredients(entry: LedgerEntry): Ingredient[] {
  const base = entry.baseServings ?? 2;
  const servings = loadServingsForDish(ledgerServingsKey(entry.id), base);
  return splitIngredientText(entry.ingredients).map((name) => ({
    name: scaleAmountText(name, servings, base),
    role: ingredientRole(name),
    uncertain: false,
  }));
}
