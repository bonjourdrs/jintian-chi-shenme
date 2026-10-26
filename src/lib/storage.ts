import { dishById } from "../data/catalog.ts";
import { DEFAULT_HEMA_TEMPLATE } from "./hema.ts";
import { sanitizeMeal } from "./meal.ts";
import type { AppState, ExtraItem, LedgerEntry, ThemeId } from "../types.ts";

const STATE_KEY = "jte.v1";
export const THEME_KEY = "jte.theme";

const THEMES: ThemeId[] = [
  "cafe-journal",
  "kitchen-chalkboard",
  "watercolor-market",
  "midnight-magazine",
];

function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.includes(value as ThemeId);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function isLedger(value: unknown): value is LedgerEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as LedgerEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.notes === "string" &&
    typeof entry.ingredients === "string" &&
    typeof entry.createdAt === "number" &&
    typeof entry.updatedAt === "number" &&
    (entry.image === undefined || typeof entry.image === "string")
  );
}

function isExtra(value: unknown): value is ExtraItem {
  if (!value || typeof value !== "object") return false;
  const extra = value as ExtraItem;
  return typeof extra.id === "string" && typeof extra.name === "string";
}

export function emptyState(): AppState {
  return {
    theme: "cafe-journal",
    hearts: [],
    menuDishIds: [],
    menuPinnedIds: [],
    menuLedgerIds: [],
    extras: [],
    bought: [],
    pantry: [],
    ledger: [],
    meal: sanitizeMeal(undefined),
    tonightNote: "",
    hemaTemplate: DEFAULT_HEMA_TEMPLATE,
  };
}

export function loadState(): AppState {
  const base = emptyState();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      const themeOnly = localStorage.getItem(THEME_KEY);
      if (isTheme(themeOnly)) base.theme = themeOnly;
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const ledger = Array.isArray(parsed.ledger) ? parsed.ledger.filter(isLedger) : [];
    const ledgerIds = new Set(ledger.map((entry) => entry.id));
    const theme = isTheme(parsed.theme) ? parsed.theme : base.theme;
    return {
      theme,
      hearts: strings(parsed.hearts).filter((id) => dishById.has(id)),
      menuDishIds: (() => {
        const ids = strings(parsed.menuDishIds).filter((id) => dishById.has(id));
        return ids;
      })(),
      menuPinnedIds: (() => {
        const ids = strings(parsed.menuDishIds).filter((id) => dishById.has(id));
        const idSet = new Set(ids);
        return strings(parsed.menuPinnedIds).filter((id) => idSet.has(id) && dishById.has(id));
      })(),
      menuLedgerIds: strings(parsed.menuLedgerIds).filter((id) => ledgerIds.has(id)),
      extras: Array.isArray(parsed.extras) ? parsed.extras.filter(isExtra) : [],
      bought: strings(parsed.bought),
      pantry: strings(parsed.pantry),
      ledger,
      meal: sanitizeMeal(parsed.meal),
      tonightNote:
        typeof parsed.tonightNote === "string" ? parsed.tonightNote.slice(0, 120) : "",
      hemaTemplate:
        typeof parsed.hemaTemplate === "string" && parsed.hemaTemplate.trim()
          ? parsed.hemaTemplate
          : DEFAULT_HEMA_TEMPLATE,
    };
  } catch {
    return base;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  localStorage.setItem(THEME_KEY, state.theme);
}
