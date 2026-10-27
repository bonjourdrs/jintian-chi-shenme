import { dishById } from "../data/catalog.ts";
import { CATEGORY_IDS, sanitizeMeal } from "./meal.ts";
import { DEFAULT_HEMA_TEMPLATE } from "./hema.ts";
import type { AppState, ExtraItem, LedgerEntry, ThemeId } from "../types.ts";
import { validDocument } from "./replica.ts";

export const LEDGER_LIMITS = { name: 300, notes: 100000, ingredients: 100000 };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isTheme(value: unknown): value is ThemeId {
  return [
    "cafe-journal",
    "kitchen-chalkboard",
    "watercolor-market",
    "midnight-magazine",
  ].includes(value as string);
}

export function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 10000 &&
    value.every(
      (item) =>
        typeof item === "string" && item.length > 0 && item.length <= 1000,
    )
  );
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

export function isLedger(value: unknown): value is LedgerEntry {
  if (!isRecord(value)) return false;
  return (
    text(value.id, 1000) &&
    value.id.length > 0 &&
    text(value.name, 300) &&
    text(value.notes, 100000) &&
    text(value.ingredients, 100000) &&
    (value.baseServings === undefined ||
      (Number.isInteger(value.baseServings) &&
        (value.baseServings as number) >= 1 &&
        (value.baseServings as number) <= 8)) &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    value.createdAt >= 0 &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt) &&
    value.updatedAt >= 0 &&
    (value.image === undefined || text(value.image, 5_000_000))
  );
}

export function isExtra(value: unknown): value is ExtraItem {
  return (
    isRecord(value) &&
    text(value.id, 1000) &&
    value.id.length > 0 &&
    text(value.name, 1000) &&
    value.name.trim().length > 0
  );
}

export function validMeal(value: unknown): boolean {
  return (
    isRecord(value) &&
    CATEGORY_IDS.every(
      (key) =>
        typeof value[key] === "number" &&
        Number.isInteger(value[key]) &&
        (value[key] as number) >= 0 &&
        (value[key] as number) <= 4,
    )
  );
}

function unique<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

/** Validate before mutation. Only the two optional v1 additions receive defaults. */
export function parseAppState(raw: unknown): AppState | null {
  if (isRecord(raw) && raw.sync !== undefined && !validDocument(raw.sync))
    return null;
  if (!isRecord(raw) || !isTheme(raw.theme) || !validMeal(raw.meal))
    return null;
  for (const key of [
    "hearts",
    "menuDishIds",
    "menuLedgerIds",
    "bought",
    "pantry",
  ] as const) {
    if (!isStringList(raw[key])) return null;
  }
  if (raw.menuPinnedIds !== undefined && !isStringList(raw.menuPinnedIds))
    return null;
  if (raw.tonightNote !== undefined && !text(raw.tonightNote, 120)) return null;
  if (!text(raw.hemaTemplate, 4000)) return null;
  if (
    !Array.isArray(raw.ledger) ||
    raw.ledger.length > 10000 ||
    !raw.ledger.every(isLedger)
  )
    return null;
  if (
    !Array.isArray(raw.extras) ||
    raw.extras.length > 10000 ||
    !raw.extras.every(isExtra)
  )
    return null;
  const list = (key: string) => [...new Set(raw[key] as string[])];
  const menuDishIds = list("menuDishIds").filter((id) => dishById.has(id));
  const ledger = unique(raw.ledger as LedgerEntry[]);
  const ledgerIds = new Set(ledger.map((entry) => entry.id));
  return {
    ...(raw.sync ? { sync: raw.sync as AppState["sync"] } : {}),
    theme: raw.theme,
    hearts: list("hearts").filter((id) => dishById.has(id)),
    menuDishIds,
    menuPinnedIds: [...new Set((raw.menuPinnedIds ?? []) as string[])].filter(
      (id) => menuDishIds.includes(id),
    ),
    menuLedgerIds: list("menuLedgerIds").filter((id) => ledgerIds.has(id)),
    bought: list("bought"),
    pantry: list("pantry"),
    extras: unique(raw.extras as ExtraItem[]),
    ledger,
    meal: sanitizeMeal(raw.meal),
    tonightNote: (raw.tonightNote ?? "") as string,
    hemaTemplate: raw.hemaTemplate.trim() || DEFAULT_HEMA_TEMPLATE,
  };
}
