export type ThemeId =
  | "cafe-journal"
  | "kitchen-chalkboard"
  | "watercolor-market"
  | "midnight-magazine";

export type CategoryId =
  | "家常热菜"
  | "肉禽"
  | "海鲜"
  | "素菜"
  | "汤"
  | "凉菜"
  | "主食";

export type MealConfig = Record<CategoryId, number>;

export type Method =
  | "stir"
  | "pan"
  | "drypot"
  | "soup"
  | "braise"
  | "cold"
  | "steam"
  | "fry"
  | "roast"
  | "staple"
  | "blanch";

export type Ingredient = {
  name: string;
  role: "main" | "seasoning";
  uncertain: boolean;
};

export type DishVideo = {
  url: string;
  likes: string;
  title: string;
};

export type Dish = {
  id: string;
  name: string;
  category: string;
  videos: DishVideo[];
  likesSamples: string[];
};

export type LedgerEntry = {
  baseServings?: number;
  id: string;
  name: string;
  notes: string;
  ingredients: string;
  image?: string;
  createdAt: number;
  updatedAt: number;
};

export type ExtraItem = {
  id: string;
  name: string;
};

export type AppState = {
  sync?: import("./lib/replica.ts").SyncDocument;
  theme: ThemeId;
  hearts: string[];
  menuDishIds: string[];
  /** Tonight dishes pinned to top — syncs with couple menu. */
  menuPinnedIds: string[];
  menuLedgerIds: string[];
  extras: ExtraItem[];
  bought: string[];
  pantry: string[];
  ledger: LedgerEntry[];
  meal: MealConfig;
  /** Shared tonight memo — syncs with couple tonight menu. */
  tonightNote: string;
  hemaTemplate: string;
};
