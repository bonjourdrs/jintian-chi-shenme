import { newId } from "../lib/id.ts";
import { recoverableState } from "../lib/recovery.ts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { dishById, dishes } from "../data/catalog.ts";
import { canonicalizeIngredientName, recipeFor } from "../data/recipes.ts";
import {
  mealTotal,
  rollMeal,
  sanitizeMeal,
  type RecipeQuality,
} from "../lib/meal.ts";
import { loadRecent } from "../lib/recent.ts";
import { pushRollHistory } from "../lib/rollHistory.ts";
import { loadRollExclude, saveRollExclude } from "../lib/rollExclude.ts";
import {
  clearStepChecks,
  clearStepChecksForIds,
  loadAllStepChecks,
  saveAllStepChecks,
} from "../lib/stepChecks.ts";
import {
  loadRollLedgerExclude,
  saveRollLedgerExclude,
  loadRollLedgerDays,
  saveRollLedgerDays,
  ledgerRecentDishIds,
  type LedgerExcludeDays,
} from "../lib/rollLedgerExclude.ts";
import {
  loadRollRejectIds,
  rejectRollBatch,
  clearRollRejects,
  rollRejectHint,
} from "../lib/rollReject.ts";
import { hapticTap } from "../lib/haptics.ts";
import { STATE_KEY, loadState, saveState } from "../lib/storage.ts";
import { themeTextureCss } from "../lib/assets.ts";
import {
  ensureThemeTexture,
  preloadThemeTextures,
} from "../lib/themeTextures.ts";
import { loadThemePulse } from "../lib/themePulse.ts";
import { themeCopy } from "../theme/themes.ts";
import { mergeSharedStates, recordSharedChanges } from "../lib/replica.ts";
import { isLedger } from "../lib/stateSchema.ts";
import {
  purchasePrefix,
  purchaseToken,
  shoppingForState,
  migrateBoughtTokens,
} from "../lib/purchases.ts";
import type {
  ExtraItem,
  AppState,
  Dish,
  LedgerEntry,
  MealConfig,
  ThemeId,
} from "../types.ts";
import { applySyncPayload, type SyncPayload } from "../lib/coupleSync.ts";

type Toast = {
  id: number;
  message: string;
  undo?: () => void;
  actionLabel?: string;
};

type AppContextValue = {
  state: AppState;
  menuDishes: Dish[];
  rolling: boolean;
  /** True for ~1s after roll reveal — blocks 再摇 so animations don't stack. */
  rollCooling: boolean;
  rollHint: string | null;
  themeOpen: boolean;
  mealOpen: boolean;
  toasts: Toast[];
  openThemes: () => void;
  closeThemes: () => void;
  openMeal: () => void;
  closeMeal: () => void;
  setTheme: (theme: ThemeId) => void;
  setMeal: (meal: MealConfig) => void;
  setTonightNote: (note: string) => void;
  setHemaTemplate: (template: string) => void;
  toggleHeart: (id: string) => void;
  removeHeart: (id: string) => { undoToken: number; index: number } | null;
  insertHeartAt: (id: string, index: number, undoToken?: number) => boolean;
  removeHearts: (
    ids: string[],
  ) => { undoToken: number; hearts: string[] } | null;
  restoreHearts: (hearts: string[], undoToken?: number) => boolean;
  reorderHearts: (from: number, to: number) => void;
  moveHeart: (id: string, dir: -1 | 1) => void;
  clearTempRollRejects: () => number;
  togglePantry: (key: string) => void;
  addDishToMenu: (id: string) => boolean;
  addDishesToMenu: (ids: string[]) => {
    added: number;
    skipped: number;
    undoToken?: number;
  };
  removeDishFromMenu: (
    id: string,
  ) => { undoToken: number; index: number } | null;
  insertDishAtMenu: (id: string, index: number, undoToken?: number) => boolean;
  removeLedgerFromMenu: (
    id: string,
  ) => { undoToken: number; index: number } | null;
  insertLedgerAtMenu: (
    id: string,
    index: number,
    undoToken?: number,
  ) => boolean;
  rejectTonightAndReroll: () => void;
  addLedgerToMenu: (id: string) => void;
  clearMenu: () => { undoToken: number; note: string };
  restoreMenu: (
    dishIds: string[],
    ledgerIds: string[],
    note?: string,
    undoToken?: number,
  ) => boolean;
  reorderMenuDishes: (from: number, to: number) => void;
  reorderMenuLedgers: (from: number, to: number) => void;
  moveMenuDish: (id: string, dir: -1 | 1) => void;
  moveMenuLedger: (id: string, dir: -1 | 1) => void;
  toggleBought: (name: string) => void;
  clearBought: () => void;
  /** Replace local-only bought checklist (采购勾选不进同步). */
  setBought: (names: string[]) => void;
  addExtra: (name: string, mode?: "add" | "replace") => boolean;
  removeExtra: (id: string) => void;
  clearExtras: () => { extras: ExtraItem[] };
  restoreExtras: (extras: ExtraItem[]) => void;
  toggleMenuDishPin: (id: string) => void;
  saveLedger: (entry: LedgerEntry) => boolean;
  deleteLedger: (
    id: string,
  ) => { undoToken: number; entry: LedgerEntry; wasInMenu: boolean } | null;
  restoreLedger: (
    entry: LedgerEntry,
    wasInMenu: boolean,
    undoToken?: number,
  ) => boolean;
  rollTonight: () => void;
  rollExclude: boolean;
  setRollExclude: (on: boolean) => void;
  rollLedgerExclude: boolean;
  setRollLedgerExclude: (on: boolean) => void;
  rollLedgerDays: LedgerExcludeDays;
  setRollLedgerDays: (days: LedgerExcludeDays) => void;
  toast: (
    message: string,
    opts?: { undo?: () => void; actionLabel?: string; ms?: number },
  ) => void;
  dismissToast: (id: number) => void;
  importSync: (payload: SyncPayload) => boolean;
  recoverCorrupt: () => boolean;
  rollChoiceOpen: boolean;
  closeRollChoice: () => void;
  replaceTonight: () => void;
  fillTonight: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, rawSetState] = useState<AppState>(() => loadState());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rolling, setRolling] = useState(false);
  const [rollCooling, setRollCooling] = useState(false);
  const [rollHint, setRollHint] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);
  const stateRef = useRef(state);
  const [rollChoiceOpen, setRollChoiceOpen] = useState(false);
  const rollTimer = useRef<number | null>(null);
  const rollCoolTimer = useRef<number | null>(null);
  /** Session-only: dishes just rolled / previously on tonight. Not persisted, not synced. */
  const sessionRollExclude = useRef<Set<string>>(new Set());
  const [rollExclude, setRollExcludeState] = useState(() => loadRollExclude());
  const [rollLedgerExclude, setRollLedgerExcludeState] = useState(() =>
    loadRollLedgerExclude(),
  );
  const [rollLedgerDays, setRollLedgerDaysState] = useState<LedgerExcludeDays>(
    () => loadRollLedgerDays(),
  );
  const setRollExclude = useCallback((on: boolean) => {
    setRollExcludeState(on);
    saveRollExclude(on);
  }, []);

  const setRollLedgerExclude = useCallback((on: boolean) => {
    setRollLedgerExcludeState(on);
    saveRollLedgerExclude(on);
  }, []);

  const setRollLedgerDays = useCallback((days: LedgerExcludeDays) => {
    setRollLedgerDaysState(days);
    saveRollLedgerDays(days);
  }, []);

  const toastTimers = useRef<Map<number, number>>(new Map());
  /** Bumped on clear and later menu edits so clear-undo expires early. */
  const menuUndoTokenRef = useRef(0);
  /** Bumped on want edits so heart-remove undo expires early. */
  const heartUndoTokenRef = useRef(0);
  /** Bumped on ledger edits so delete-undo expires early. */
  const ledgerUndoTokenRef = useRef(0);

  const toast = useCallback(
    (
      message: string,
      opts?: { undo?: () => void; actionLabel?: string; ms?: number },
    ) => {
      const id = Date.now() + Math.random();
      const undo = opts?.undo;
      const actionLabel = opts?.actionLabel;
      const ms = opts?.ms ?? (undo ? 5200 : 2600);
      setToasts((current) => {
        // Max 2 visible: drop oldest when pushing; replace identical trailing message
        const trimmed =
          current.length &&
          current[current.length - 1]?.message === message &&
          !undo
            ? current.slice(0, -1)
            : current;
        return [...trimmed, { id, message, undo, actionLabel }].slice(-2);
      });
      const prev = toastTimers.current.get(id);
      if (prev) window.clearTimeout(prev);
      const timer = window.setTimeout(() => {
        toastTimers.current.delete(id);
        setToasts((current) => current.filter((item) => item.id !== id));
      }, ms);
      toastTimers.current.set(id, timer);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    stateRef.current = state;
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.setProperty(
      "--theme-texture",
      themeTextureCss(state.theme),
    );
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeCopy(state.theme).color);
  }, [state]);

  useEffect(() => {
    return () => {
      if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
      if (rollCoolTimer.current !== null)
        window.clearTimeout(rollCoolTimer.current);
    };
  }, []);

  const setState = useCallback(
    (recipe: (current: AppState) => AppState): boolean => {
      try {
        const latest = loadState();
        const current = migrateBoughtTokens(
          mergeSharedStates(latest, stateRef.current),
        );
        const next = recordSharedChanges(current, recipe(current));
        const saved = saveState(next);
        stateRef.current = saved;
        rawSetState(saved);
        return true;
      } catch (error) {
        toast(
          error instanceof Error
            ? `未保存：${error.message}`
            : "保存失败，改动未提交",
        );
        return false;
      }
    },
    [toast],
  );
  const patch = setState;

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STATE_KEY || !event.newValue) return;
      try {
        const latest = loadState();
        const merged = mergeSharedStates(latest, stateRef.current);
        const saved =
          JSON.stringify(merged) === JSON.stringify(latest)
            ? latest
            : saveState(merged);
        stateRef.current = saved;
        rawSetState(saved);
      } catch {
        toast("另一标签页的数据暂未合并，请导出备份后重试");
      }
    };
    const beforeServings = () => setState((current) => current);
    const onServings = () => rawSetState((current) => ({ ...current }));
    window.addEventListener("jte-before-servings-change", beforeServings);
    window.addEventListener("storage", onStorage);
    window.addEventListener("jte-servings-changed", onServings);
    return () => {
      window.removeEventListener("jte-before-servings-change", beforeServings);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("jte-servings-changed", onServings);
    };
  }, [toast, setState]);

  const menuDishes = useMemo(
    () =>
      state.menuDishIds
        .map((id) => dishById.get(id))
        .filter((dish): dish is Dish => Boolean(dish)),
    [state.menuDishIds],
  );

  const performRoll = useCallback(
    (fill = false) => {
      if (rolling || rollCooling) return;
      hapticTap();
      const current = stateRef.current;
      if (mealTotal(current.meal) <= 0) {
        toast("先定一下几菜几汤");
        setMealOpen(true);
        return;
      }
      const quality = (dish: Dish): RecipeQuality => {
        const recipe = recipeFor(dish);
        if (recipe.fromOverride) return "rich";
        if (
          !recipe.unparsed &&
          recipe.ingredients.some((item) => item.role === "main")
        )
          return "ok";
        return "empty";
      };
      // Soft-exclude: temporary rejects always; tonight/recent/session + ledger window when on.
      const soft = new Set<string>(loadRollRejectIds());
      if (rollExclude) {
        for (const id of sessionRollExclude.current) soft.add(id);
        for (const id of current.menuDishIds) soft.add(id);
        for (const item of loadRecent().slice(0, 8)) soft.add(item.id);
      }
      let ledgerExcluded = 0;
      if (rollLedgerExclude) {
        const ledgerIds = ledgerRecentDishIds(
          current.ledger,
          dishes,
          rollLedgerDays,
        );
        ledgerExcluded = ledgerIds.size;
        for (const id of ledgerIds) soft.add(id);
      }
      const remainingMeal = { ...current.meal };
      if (fill)
        for (const dish of current.menuDishIds.map((id) => dishById.get(id))) {
          if (dish && dish.category in remainingMeal)
            remainingMeal[dish.category as keyof MealConfig] = Math.max(
              0,
              remainingMeal[dish.category as keyof MealConfig] - 1,
            );
        }
      const remainingCount = fill
        ? Math.max(
            0,
            mealTotal(current.meal) -
              current.menuDishIds.length -
              current.menuLedgerIds.length,
          )
        : mealTotal(current.meal);
      if (remainingCount === 0) {
        toast("今晚已凑齐搭配，可手动再加菜");
        return;
      }
      for (const id of current.menuDishIds) soft.add(id);
      const rolled = rollMeal(
        fill ? remainingMeal : current.meal,
        dishes,
        Math.random,
        quality,
        soft.size > 0 ? soft : undefined,
      );
      const picked = fill
        ? rolled.dishes
            .filter((dish) => !current.menuDishIds.includes(dish.id))
            .slice(0, remainingCount)
        : rolled.dishes;
      const relaxed = rolled.relaxed;
      if (picked.length === 0) {
        toast("这个搭配没有菜可摇");
        return;
      }
      const target = mealTotal(current.meal);
      if (relaxed && soft.size > 0) {
        const why = [
          rollExclude ? "避开已选" : null,
          rollLedgerExclude && ledgerExcluded > 0
            ? `账本近${rollLedgerDays}天`
            : null,
          "临时排除",
        ]
          .filter(Boolean)
          .join(" / ");
        toast(`可选菜不够，已放宽${why || "排除"}`, { ms: 3000 });
      } else if (picked.length < target) {
        toast(
          `按搭配想摇 ${target} 道，库里只凑到 ${picked.length} 道，先这样吧`,
        );
      }
      for (const dish of picked) sessionRollExclude.current.add(dish.id);
      if (sessionRollExclude.current.size > 80) {
        sessionRollExclude.current = new Set(picked.map((dish) => dish.id));
      }
      const refinedCount = picked.filter(
        (dish) => recipeFor(dish).fromOverride,
      ).length;
      const feel = refinedCount > 0 ? "偏向精修菜谱" : null;
      const apply = () => {
        const before = stateRef.current;
        const stepsBefore = loadAllStepChecks();
        pushRollHistory(
          picked.map((dish) => ({ id: dish.id, name: dish.name })),
        );
        menuUndoTokenRef.current += 1;
        const nextIds = fill
          ? [...before.menuDishIds, ...picked.map((dish) => dish.id)]
          : picked.map((dish) => dish.id);
        const keep = new Set(nextIds);
        const dropped = stateRef.current.menuDishIds.filter(
          (id) => !keep.has(id),
        );
        const saved = setState((prev) => ({
          ...prev,
          menuDishIds: nextIds,
          menuPinnedIds: fill ? prev.menuPinnedIds : [],
          menuLedgerIds: fill ? prev.menuLedgerIds : [],
        }));
        if (saved) {
          clearStepChecksForIds(dropped);
          const token = menuUndoTokenRef.current;
          toast(fill ? "已补齐今晚菜单" : "已换一桌，原菜单可撤销", {
            ms: 12000,
            undo: () => {
              if (menuUndoTokenRef.current !== token) {
                toast("菜单已有其他改动，无法撤销");
                return;
              }
              menuUndoTokenRef.current += 1;
              if (
                setState((prev) => ({
                  ...prev,
                  menuDishIds: before.menuDishIds,
                  menuLedgerIds: before.menuLedgerIds,
                  menuPinnedIds: before.menuPinnedIds,
                  tonightNote: before.tonightNote,
                  bought: [...new Set([...prev.bought, ...before.bought])],
                }))
              )
                saveAllStepChecks(stepsBefore);
            },
          });
        }
        setRolling(false);
        setRollHint(null);
        setRollCooling(true);
        if (rollCoolTimer.current !== null)
          window.clearTimeout(rollCoolTimer.current);
        rollCoolTimer.current = window.setTimeout(
          () => setRollCooling(false),
          1000,
        );
        navigate("/tonight");
      };
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) {
        apply();
        return;
      }
      setRollHint(feel);
      setRolling(true);
      if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
      rollTimer.current = window.setTimeout(apply, 560);
    },
    [
      navigate,
      toast,
      rollExclude,
      rollLedgerExclude,
      rollLedgerDays,
      rolling,
      rollCooling,
      setState,
    ],
  );
  const rollTonight = useCallback(() => {
    if (
      stateRef.current.menuDishIds.length ||
      stateRef.current.menuLedgerIds.length
    )
      setRollChoiceOpen(true);
    else performRoll();
  }, [performRoll]);

  const importSync = useCallback(
    (payload: SyncPayload) => {
      try {
        const current = loadState();
        const next = applySyncPayload(
          mergeSharedStates(current, stateRef.current),
          payload,
        );
        const saved = saveState(next);
        stateRef.current = saved;
        rawSetState(saved);
        return true;
      } catch {
        toast("同步内容未保存，本机数据已保留");
        return false;
      }
    },
    [toast],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      recoverCorrupt: () => {
        const recovered = recoverableState();
        if (!recovered) {
          toast("原文件无法解析，请先导出隔离原文");
          return false;
        }
        const ok = patch((current) => mergeSharedStates(current, recovered));
        toast(ok ? "已合并有效记录，原文件仍保留" : "恢复未完成，原文件仍保留");
        return ok;
      },
      rollChoiceOpen,
      closeRollChoice: () => setRollChoiceOpen(false),
      replaceTonight: () => {
        setRollChoiceOpen(false);
        performRoll();
      },
      fillTonight: () => {
        setRollChoiceOpen(false);
        performRoll(true);
      },
      menuDishes,
      rolling,
      rollCooling,
      rollHint,
      themeOpen,
      mealOpen,
      toasts,
      openThemes: () => setThemeOpen(true),
      closeThemes: () => setThemeOpen(false),
      openMeal: () => setMealOpen(true),
      closeMeal: () => setMealOpen(false),
      setTheme: (theme) => {
        void ensureThemeTexture(theme);
        preloadThemeTextures();
        const root = document.documentElement;
        root.classList.add("is-theme-crossfade");
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (loadThemePulse() && !reduce) {
          root.classList.remove("is-theme-pulse");
          // reflow so re-triggering pulse works on rapid switches
          void root.offsetWidth;
          root.classList.add("is-theme-pulse");
          window.setTimeout(() => root.classList.remove("is-theme-pulse"), 520);
        }
        /* Apply tokens immediately so React re-render doesn't flash the old palette. */
        root.dataset.theme = theme;
        root.style.setProperty("--theme-texture", themeTextureCss(theme));
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", themeCopy(theme).color);
        window.setTimeout(
          () => root.classList.remove("is-theme-crossfade"),
          420,
        );
        patch((current) => ({ ...current, theme }));
      },
      setMeal: (meal) =>
        patch((current) => ({ ...current, meal: sanitizeMeal(meal) })),
      setTonightNote: (note) => {
        menuUndoTokenRef.current += 1;
        patch((current) => ({
          ...current,
          tonightNote: note.replace(/\r/g, "").slice(0, 120),
        }));
      },
      setHemaTemplate: (hemaTemplate) =>
        patch((current) => ({ ...current, hemaTemplate })),
      toggleHeart: (id) => {
        heartUndoTokenRef.current += 1;
        patch((current) => ({
          ...current,
          hearts: current.hearts.includes(id)
            ? current.hearts.filter((item) => item !== id)
            : [id, ...current.hearts],
        }));
      },
      removeHeart: (id) => {
        const cur = stateRef.current;
        const index = cur.hearts.indexOf(id);
        if (index < 0) return null;
        const token = ++heartUndoTokenRef.current;
        patch((current) => ({
          ...current,
          hearts: current.hearts.filter((item) => item !== id),
        }));
        return { undoToken: token, index };
      },
      insertHeartAt: (id, index, undoToken) => {
        if (undoToken != null && undoToken !== heartUndoTokenRef.current)
          return false;
        heartUndoTokenRef.current += 1;
        patch((current) => {
          if (current.hearts.includes(id)) {
            return current;
          }
          const ids = current.hearts.slice();
          const at = Math.max(0, Math.min(index, ids.length));
          ids.splice(at, 0, id);
          return { ...current, hearts: ids };
        });
        return true;
      },
      removeHearts: (ids) => {
        const want = [...new Set(ids.filter(Boolean))];
        if (want.length === 0) return null;
        const cur = stateRef.current;
        if (!want.some((id) => cur.hearts.includes(id))) return null;
        const snapshot = cur.hearts.slice();
        const token = ++heartUndoTokenRef.current;
        const drop = new Set(want);
        patch((current) => ({
          ...current,
          hearts: current.hearts.filter((id) => !drop.has(id)),
        }));
        return { undoToken: token, hearts: snapshot };
      },
      restoreHearts: (hearts, undoToken) => {
        if (undoToken != null && undoToken !== heartUndoTokenRef.current)
          return false;
        heartUndoTokenRef.current += 1;
        patch((current) => ({ ...current, hearts: hearts.slice() }));
        return true;
      },
      reorderHearts: (from, to) => {
        heartUndoTokenRef.current += 1;
        patch((current) => {
          const ids = current.hearts.slice();
          if (
            from < 0 ||
            to < 0 ||
            from >= ids.length ||
            to >= ids.length ||
            from === to
          ) {
            return current;
          }
          const [item] = ids.splice(from, 1);
          if (!item) return current;
          ids.splice(to, 0, item);
          return { ...current, hearts: ids };
        });
      },
      moveHeart: (id, dir) => {
        heartUndoTokenRef.current += 1;
        patch((current) => {
          const ids = current.hearts.slice();
          const from = ids.indexOf(id);
          if (from < 0) return current;
          const to = from + dir;
          if (to < 0 || to >= ids.length) return current;
          const tmp = ids[from]!;
          ids[from] = ids[to]!;
          ids[to] = tmp;
          return { ...current, hearts: ids };
        });
      },
      clearTempRollRejects: () => {
        const n = loadRollRejectIds().size;
        clearRollRejects();
        return n;
      },
      togglePantry: (key) =>
        patch((current) => ({
          ...current,
          pantry: current.pantry.includes(key)
            ? current.pantry.filter((item) => item !== key)
            : [...current.pantry, key],
        })),
      addDishToMenu: (id) => {
        const current = stateRef.current;
        if (current.menuDishIds.includes(id)) return false;
        menuUndoTokenRef.current += 1;
        const nextCount =
          current.menuDishIds.length + 1 + current.menuLedgerIds.length;
        const target = mealTotal(current.meal);
        patch((prev) =>
          prev.menuDishIds.includes(id)
            ? prev
            : { ...prev, menuDishIds: [...prev.menuDishIds, id] },
        );
        if (target > 0 && nextCount > target) {
          toast(
            `今晚已有 ${nextCount} 道，比搭配多 ${nextCount - target} 道（可继续加）`,
          );
        }
        return true;
      },
      addDishesToMenu: (ids) => {
        const unique = Array.from(new Set(ids.filter(Boolean)));
        const currentIds = stateRef.current.menuDishIds;
        const toAdd: string[] = [];
        let skipped = 0;
        for (const id of unique) {
          if (currentIds.includes(id) || toAdd.includes(id)) skipped += 1;
          else toAdd.push(id);
        }
        if (toAdd.length === 0) return { added: 0, skipped };
        const undoToken = ++menuUndoTokenRef.current;
        patch((current) => ({
          ...current,
          menuDishIds: [
            ...current.menuDishIds,
            ...toAdd.filter((id) => !current.menuDishIds.includes(id)),
          ],
        }));
        return { added: toAdd.length, skipped, undoToken };
      },
      removeDishFromMenu: (id) => {
        const cur = stateRef.current;
        const index = cur.menuDishIds.indexOf(id);
        if (index < 0) return null;
        const token = ++menuUndoTokenRef.current;
        patch((current) => ({
          ...current,
          menuDishIds: current.menuDishIds.filter((item) => item !== id),
          menuPinnedIds: (current.menuPinnedIds || []).filter(
            (item) => item !== id,
          ),
        }));
        clearStepChecks(id);
        return { undoToken: token, index };
      },
      insertDishAtMenu: (id, index, undoToken) => {
        if (undoToken != null && undoToken !== menuUndoTokenRef.current)
          return false;
        menuUndoTokenRef.current += 1;
        patch((current) => {
          if (current.menuDishIds.includes(id)) {
            return current;
          }
          const ids = current.menuDishIds.slice();
          const at = Math.max(0, Math.min(index, ids.length));
          ids.splice(at, 0, id);
          return { ...current, menuDishIds: ids };
        });
        return true;
      },
      addLedgerToMenu: (id) => {
        menuUndoTokenRef.current += 1;
        patch((current) =>
          current.menuLedgerIds.includes(id)
            ? current
            : { ...current, menuLedgerIds: [...current.menuLedgerIds, id] },
        );
      },
      removeLedgerFromMenu: (id) => {
        const cur = stateRef.current;
        const index = cur.menuLedgerIds.indexOf(id);
        if (index < 0) return null;
        const token = ++menuUndoTokenRef.current;
        patch((current) => ({
          ...current,
          menuLedgerIds: current.menuLedgerIds.filter((item) => item !== id),
        }));
        return { undoToken: token, index };
      },
      insertLedgerAtMenu: (id, index, undoToken) => {
        if (undoToken != null && undoToken !== menuUndoTokenRef.current)
          return false;
        menuUndoTokenRef.current += 1;
        patch((current) => {
          if (current.menuLedgerIds.includes(id)) {
            return current;
          }
          const ids = current.menuLedgerIds.slice();
          const at = Math.max(0, Math.min(index, ids.length));
          ids.splice(at, 0, id);
          return { ...current, menuLedgerIds: ids };
        });
        return true;
      },
      rejectTonightAndReroll: () => {
        const ids = stateRef.current.menuDishIds.slice();
        if (ids.length === 0) {
          toast("今晚还空着，先摇一桌");
          return;
        }
        const n = rejectRollBatch(ids);
        const hint = rollRejectHint();
        toast(
          n > 0
            ? `已临时排除这 ${n} 道（约 30 分钟）${hint ? " · " + hint : ""}，再摇中`
            : "临时排除已满，再摇会尽量避开",
          { ms: 3200 },
        );
        // Defer roll so toast paints; rollTonight will soft-exclude rejects.
        window.setTimeout(() => rollTonight(), 40);
      },
      clearMenu: () => {
        const token = ++menuUndoTokenRef.current;
        let note = "";
        const dropped = stateRef.current.menuDishIds.slice();
        patch((current) => {
          note = current.tonightNote || "";
          return {
            ...current,
            menuDishIds: [],
            menuPinnedIds: [],
            menuLedgerIds: [],
            tonightNote: "",
          };
        });
        clearStepChecksForIds(dropped);
        return { undoToken: token, note };
      },
      restoreMenu: (dishIds, ledgerIds, note, undoToken) => {
        if (undoToken != null && undoToken !== menuUndoTokenRef.current)
          return false;
        menuUndoTokenRef.current += 1;
        patch((current) => ({
          ...current,
          menuDishIds: dishIds.slice(),
          menuPinnedIds: (current.menuPinnedIds || []).filter((id) =>
            dishIds.includes(id),
          ),
          menuLedgerIds: ledgerIds.slice(),
          tonightNote:
            typeof note === "string" ? note.slice(0, 120) : current.tonightNote,
        }));
        return true;
      },
      reorderMenuDishes: (from, to) => {
        menuUndoTokenRef.current += 1;
        patch((current) => {
          const ids = current.menuDishIds.slice();
          if (
            from < 0 ||
            to < 0 ||
            from >= ids.length ||
            to >= ids.length ||
            from === to
          )
            return current;
          const [item] = ids.splice(from, 1);
          if (!item) return current;
          ids.splice(to, 0, item);
          const pinSet = new Set(current.menuPinnedIds || []);
          return {
            ...current,
            menuDishIds: ids,
            menuPinnedIds: ids.filter((id) => pinSet.has(id)),
          };
        });
      },
      reorderMenuLedgers: (from, to) => {
        menuUndoTokenRef.current += 1;
        patch((current) => {
          const ids = current.menuLedgerIds.slice();
          if (
            from < 0 ||
            to < 0 ||
            from >= ids.length ||
            to >= ids.length ||
            from === to
          )
            return current;
          const [item] = ids.splice(from, 1);
          if (!item) return current;
          ids.splice(to, 0, item);
          return { ...current, menuLedgerIds: ids };
        });
      },
      moveMenuDish: (id, dir) =>
        patch((current) => {
          const ids = current.menuDishIds.slice();
          const from = ids.indexOf(id);
          if (from < 0) return current;
          const to = from + dir;
          if (to < 0 || to >= ids.length) return current;
          const tmp = ids[from]!;
          ids[from] = ids[to]!;
          ids[to] = tmp;
          const pinSet = new Set(current.menuPinnedIds || []);
          return {
            ...current,
            menuDishIds: ids,
            menuPinnedIds: ids.filter((pid) => pinSet.has(pid)),
          };
        }),
      moveMenuLedger: (id, dir) =>
        patch((current) => {
          const ids = current.menuLedgerIds.slice();
          const from = ids.indexOf(id);
          if (from < 0) return current;
          const to = from + dir;
          if (to < 0 || to >= ids.length) return current;
          const tmp = ids[from]!;
          ids[from] = ids[to]!;
          ids[to] = tmp;
          return { ...current, menuLedgerIds: ids };
        }),
      toggleBought: (name) => {
        setState((current) => {
          const list = shoppingForState(current);
          const item = [...list.foods, ...list.seasonings].find(
            (item) => item.name === name,
          );
          if (!item) return current;
          const token = purchaseToken(item);
          const bought = current.bought.filter(
            (value) =>
              value !== name && !value.startsWith(purchasePrefix(name)),
          );
          return {
            ...current,
            bought: item.bought ? bought : [...bought, token],
          };
        });
      },
      clearBought: () => {
        setState((current) => ({ ...current, bought: [] }));
      },
      setBought: (names) => {
        setState((current) => {
          const list = shoppingForState(current);
          return {
            ...current,
            bought: [...list.foods, ...list.seasonings]
              .filter((item) => names.includes(item.name))
              .map(purchaseToken),
          };
        });
      },
      addExtra: (name, mode = "add") => {
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 1000) return false;
        const canon = canonicalizeIngredientName(trimmed) || trimmed;
        return patch((current) => ({
          ...current,
          extras: [
            ...(mode === "replace"
              ? current.extras.filter(
                  (item) => canonicalizeIngredientName(item.name) !== canon,
                )
              : current.extras),
            { id: newId(), name: trimmed },
          ],
        }));
      },
      removeExtra: (id) =>
        patch((current) => ({
          ...current,
          extras: current.extras.filter((item) => item.id !== id),
        })),
      clearExtras: () => {
        const extras = stateRef.current.extras.slice();
        patch((current) => ({ ...current, extras: [] }));
        return { extras };
      },
      restoreExtras: (extras) => {
        patch((current) => ({ ...current, extras: extras.slice() }));
      },
      toggleMenuDishPin: (id) => {
        if (!id) return;
        menuUndoTokenRef.current += 1;
        patch((current) => {
          if (!current.menuDishIds.includes(id)) return current;
          const pins = (current.menuPinnedIds || []).filter((pid) =>
            current.menuDishIds.includes(pid),
          );
          const pinned = pins.includes(id);
          let nextPins: string[];
          if (pinned) {
            nextPins = pins.filter((pid) => pid !== id);
          } else {
            nextPins = [id, ...pins.filter((pid) => pid !== id)];
          }
          const unpinned = current.menuDishIds.filter(
            (pid) => !nextPins.includes(pid),
          );
          return {
            ...current,
            menuPinnedIds: nextPins,
            menuDishIds: [...nextPins, ...unpinned],
          };
        });
      },
      saveLedger: (entry) => {
        if (!isLedger(entry) || !entry.name.trim()) {
          toast("菜名最多300字，食材/笔记最多100000字；未保存");
          return false;
        }
        ledgerUndoTokenRef.current += 1;
        return patch((current) => {
          const exists = current.ledger.some((item) => item.id === entry.id);
          return {
            ...current,
            ledger: exists
              ? current.ledger.map((item) =>
                  item.id === entry.id ? entry : item,
                )
              : [entry, ...current.ledger],
          };
        });
      },
      deleteLedger: (id) => {
        const cur = stateRef.current;
        const entry = cur.ledger.find((item) => item.id === id);
        if (!entry) return null;
        const wasInMenu = cur.menuLedgerIds.includes(id);
        const token = ++ledgerUndoTokenRef.current;
        patch((current) => ({
          ...current,
          ledger: current.ledger.filter((item) => item.id !== id),
          menuLedgerIds: current.menuLedgerIds.filter((item) => item !== id),
        }));
        return { undoToken: token, entry: { ...entry }, wasInMenu };
      },
      restoreLedger: (entry, wasInMenu, undoToken) => {
        if (undoToken != null && undoToken !== ledgerUndoTokenRef.current)
          return false;
        ledgerUndoTokenRef.current += 1;
        patch((current) => {
          const without = current.ledger.filter((item) => item.id !== entry.id);
          const ledger = [entry, ...without];
          let menuLedgerIds = current.menuLedgerIds.filter(
            (item) => item !== entry.id,
          );
          if (wasInMenu && !menuLedgerIds.includes(entry.id)) {
            menuLedgerIds = [...menuLedgerIds, entry.id];
          }
          return { ...current, ledger, menuLedgerIds };
        });
        return true;
      },
      rollTonight,
      rollExclude,
      setRollExclude,
      rollLedgerExclude,
      setRollLedgerExclude,
      rollLedgerDays,
      setRollLedgerDays,
      toast,
      dismissToast,
      importSync,
    }),
    [
      rollChoiceOpen,
      performRoll,
      setState,
      importSync,
      dismissToast,
      mealOpen,
      menuDishes,
      patch,
      rollExclude,
      rollLedgerExclude,
      rollLedgerDays,
      rollHint,
      rollTonight,
      rolling,
      rollCooling,
      setRollExclude,
      setRollLedgerExclude,
      setRollLedgerDays,
      state,
      themeOpen,
      toast,
      toasts,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook lives next to the provider so callers share one context.
// oxlint-disable-next-line react/only-export-components
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp 必须放在 AppProvider 里");
  return context;
}
