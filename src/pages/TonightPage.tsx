import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { DishArt, EmptyArt } from "../components/Art.tsx";
import { SearchIcon } from "../components/Icons.tsx";
import { searchDishes } from "../data/catalog.ts";
import { menuIngredientsPlainText, recipeFor } from "../data/recipes.ts";
import { hapticTap } from "../lib/haptics.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import {
  applyTonightUnifiedServings,
  baseServings,
  clearTonightUnifiedServings,
  clampServings,
  loadServingsForDish,
  loadTonightUnifiedServings,
  MAX_SERVINGS,
  MIN_SERVINGS,
  scaleAmountText,
} from "../lib/servings.ts";
import {
  copyHemaKeywords,
  copyText,
  hemaKeywords,
  hemaSearchAppendix,
  hemaSearchTerm,
  openHema,
} from "../lib/hema.ts";
import { isOnline } from "../lib/online.ts";
import { buildTonightShareText, shareOrCopy } from "../lib/share.ts";
import { mealProgressParts, mealSummary, mealTotal, menuVsMealHint } from "../lib/meal.ts";
import {
  mergeTonightIngredients,
  mergedShoppingPlainText,
} from "../lib/shopping.ts";
import { useTitle } from "../lib/useTitle.ts";
import { SyncChip } from "../components/SyncChip.tsx";
import { RollHistoryChips } from "../components/RollHistoryChips.tsx";
import { loadRollRejectIds, rollRejectHint } from "../lib/rollReject.ts";
import { useApp } from "../state/store.tsx";

type DragKind = "dish" | "ledger";

export function TonightPage() {
  useTitle("今晚菜单");
  const {
    state,
    menuDishes,
    rollTonight,
    rolling, rollCooling,
    openMeal,
    clearMenu,
    restoreMenu,
    removeDishFromMenu,
    removeLedgerFromMenu,
    insertDishAtMenu,
    insertLedgerAtMenu,
    rejectTonightAndReroll,
    clearTempRollRejects,
    addDishToMenu,
    reorderMenuDishes,
    reorderMenuLedgers,
    moveMenuDish,
    moveMenuLedger,
    toggleMenuDishPin,
    toast,
    rollExclude,
    setRollExclude,
    rollLedgerExclude,
    setRollLedgerExclude,
    rollLedgerDays,
    setRollLedgerDays,
    saveLedger,
    setTonightNote,
  } = useApp();
  const [pickQuery, setPickQuery] = useState("");
  const [reveal, setReveal] = useState(false);
  const [tonightMore, setTonightMore] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [unifiedServings, setUnifiedServings] = useState<number>(() => loadTonightUnifiedServings() ?? baseServings());
  const [hasUnified, setHasUnified] = useState(() => loadTonightUnifiedServings() != null);
  const [servingsTick, setServingsTick] = useState(0);

  const [showMerged, setShowMerged] = useState(false);
  const [drag, setDrag] = useState<{ kind: DragKind; index: number } | null>(null);
  const [rejectTick, setRejectTick] = useState(0);
  const [over, setOver] = useState<{ kind: DragKind; index: number } | null>(null);
  const wasRolling = useRef(false);

  const rejectCount = useMemo(() => {
    void rejectTick;
    void rolling;
    return loadRollRejectIds().size;
  }, [rejectTick, rolling]);

  useEffect(() => {
    if (!tonightMore && !clearConfirm) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTonightMore(false);
        setClearConfirm(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tonightMore, clearConfirm]);

  const ledgerEntries = state.menuLedgerIds
    .map((id) => state.ledger.find((entry) => entry.id === id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const empty = menuDishes.length === 0 && ledgerEntries.length === 0;
  const pickNeedle = pickQuery.trim();
  const pickHits = useMemo(() => {
    if (!pickNeedle) return [];
    return searchDishes(pickNeedle)
      .filter((dish) => !state.menuDishIds.includes(dish.id))
      .slice(0, 8);
  }, [pickNeedle, state.menuDishIds]);

  /* After roll overlay ends, play a short card reveal on the list (blur→clear). */
  useEffect(() => {
    if (wasRolling.current && !rolling && !empty) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        setReveal(true);
        const id = window.setTimeout(() => setReveal(false), 680);
        wasRolling.current = false;
        return () => window.clearTimeout(id);
      }
    }
    wasRolling.current = rolling;
    return undefined;
  }, [rolling, empty]);

  const tonightIngredientItems = () => {
    const fromDishes = menuDishes.map((dish) => {
      const recipe = recipeFor(dish);
      if (recipe.unparsed) return { name: dish.name, ingredients: [] as typeof recipe.ingredients };
      const servings = loadServingsForDish(dish.id);
      const ingredients = recipe.ingredients.map((ing) => ({
        ...ing,
        name: scaleAmountText(ing.name, servings),
      }));
      return { name: dish.name, ingredients };
    });
    const fromLedger = ledgerEntries.map((entry) => {
      const names = entry.ingredients
        .split(/\n|,|，/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        name: entry.name,
        ingredients: names.map((name) => ({ name, role: "main" as const, uncertain: false })),
      };
    });
    return [...fromDishes, ...fromLedger];
  };

  const servingsScaled = useMemo(
    () => menuDishes.some((dish) => loadServingsForDish(dish.id) !== baseServings()),
    [menuDishes, servingsTick],
  );

  const mergedLines = useMemo(() => {
    const fromDishes = menuDishes.map((dish) => {
      const recipe = recipeFor(dish);
      if (recipe.unparsed) return { name: dish.name, ingredients: [] as typeof recipe.ingredients };
      const servings = loadServingsForDish(dish.id);
      const ingredients = recipe.ingredients.map((ing) => ({
        ...ing,
        name: scaleAmountText(ing.name, servings),
      }));
      return { name: dish.name, ingredients };
    });
    const fromLedger = ledgerEntries.map((entry) => {
      const names = entry.ingredients
        .split(/\n|,|，/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        name: entry.name,
        ingredients: names.map((name) => ({ name, role: "main" as const, uncertain: false })),
      };
    });
    return mergeTonightIngredients([...fromDishes, ...fromLedger].filter((item) => item.ingredients.length > 0));
  }, [menuDishes, ledgerEntries, servingsTick]);

  const copyMergedList = async () => {
    if (mergedLines.length === 0) {
      toast("还没有可合并的食材");
      return;
    }
    const body = mergedShoppingPlainText(mergedLines);
    const hema = hemaSearchAppendix(mergedLines.map((line) => line.name));
    const ok = await copyText(hema ? `${body}

${hema}` : body);
    toast(ok ? "已复制（含盒马可搜关键词）" : "没能复制，请手动选择");
  };


  const recordTonightToLedger = () => {
    if (!oncePrimary("tonight-ledger")) return;
    if (empty) {
      toast("今晚还没有菜可记");
      return;
    }
    const names = [
      ...menuDishes.map((dish) => dish.name),
      ...ledgerEntries.map((entry) => entry.name),
    ];
    const dateLabel = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(new Date());
    const name =
      names.length <= 2
        ? names.join("、")
        : `${names.slice(0, 2).join("、")}等${names.length}道`;
    const ingredientLines: string[] = [];
    for (const dish of menuDishes) {
      for (const ing of recipeFor(dish).ingredients) {
        if (ing.role === "main") ingredientLines.push(ing.name);
      }
    }
    for (const entry of ledgerEntries) {
      for (const line of entry.ingredients.split(/\n+/)) {
        const trim = line.trim();
        if (trim) ingredientLines.push(trim);
      }
    }
    const unique = [...new Set(ingredientLines)];
    const now = Date.now();
    saveLedger({
      id: crypto.randomUUID(),
      name,
      notes: `今晚菜单 · ${dateLabel}\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}`,
      ingredients: unique.join("\n"),
      createdAt: now,
      updatedAt: now,
    });
    hapticTap();
    toast(`已记入账本 · ${names.length} 道`, { ms: 2800 });
  };

  const exportMenu = async () => {
    const day = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(new Date());
    const note = (state.tonightNote || "").trim();
    const lines = [
      `今晚菜单 · ${day}`,
      `搭配：${mealSummary(state.meal)}`,
      ...(note ? [`备忘：${note}`] : []),
      "",
      "【菜名】",
      ...menuDishes.map((dish, i) => `${i + 1}. ${dish.name}`),
      ...ledgerEntries.map((entry, i) => `${menuDishes.length + i + 1}. ${entry.name}（账本）`),
    ];
    const items = tonightIngredientItems().filter((item) => item.ingredients.length > 0);
    if (items.length > 0) {
      lines.push("", "【按菜食材】", menuIngredientsPlainText(items));
    }
    if (mergedLines.length > 0) {
      lines.push("", "【合并采购 · 可选】", mergedShoppingPlainText(mergedLines));
    }
    const hema = hemaSearchAppendix(mergedLines.map((line) => line.name));
    if (hema) lines.push("", hema);
    lines.push("", "— 来自「今天吃什么」· https://jintian-chi-shenme.deed.page/ · 盒马请自行搜索，不是一键加购 —");
    const ok = await copyText(lines.join("\n"));
    toast(ok ? "菜单已导出（含搭配、采购摘要与盒马可搜关键词）" : "没能复制，请手动选择");
  };

  const copyTonightIngredients = async () => {
    const items = tonightIngredientItems().filter((item) => item.ingredients.length > 0);
    if (items.length === 0) {
      toast("还没有可复制的食材");
      return;
    }
    const ok = await copyText(menuIngredientsPlainText(items));
    toast(ok ? "已复制" : "没能复制，请手动选择");
  };

  const shareTonight = async () => {
    if (menuDishes.length === 0 && ledgerEntries.length === 0) {
      toast("还没有可分享的菜单");
      return;
    }
    const items = tonightIngredientItems().filter((item) => item.ingredients.length > 0);
    const ingredientLines: string[] = [];
    for (const item of items) {
      for (const ing of item.ingredients) {
        if (ing.role === "main") ingredientLines.push(ing.name);
      }
    }
    const unique = [...new Set(ingredientLines)];
    const payload = buildTonightShareText({
      mealLabel: mealSummary(state.meal),
      dishes: [
        ...menuDishes.map((dish) => dish.name),
        ...ledgerEntries.map((entry) => `${entry.name}（账本）`),
      ],
      ingredients: unique,
      note: state.tonightNote,
    });
    await shareOrCopy(payload, toast);
  };

  const shareTonightIngredients = async () => {
    const items = tonightIngredientItems().filter((item) => item.ingredients.length > 0);
    if (items.length === 0) {
      toast("还没有可分享的食材");
      return;
    }
    const text = menuIngredientsPlainText(items);
    await shareOrCopy({ title: "今晚食材清单 · 今天吃什么", text: `${text}\n\n打开「今天吃什么」一起看看吧`, url: "https://jintian-chi-shenme.deed.page/" }, toast);
  };

  const onDragStart = (kind: DragKind, index: number) => (event: DragEvent) => {
    setDrag({ kind, index });
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("text/plain", `${kind}:${index}`);
    } catch {
      /* some browsers */
    }
  };

  const onDragOver = (kind: DragKind, index: number) => (event: DragEvent) => {
    if (!drag || drag.kind !== kind) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!over || over.kind !== kind || over.index !== index) setOver({ kind, index });
  };

  const onDrop = (kind: DragKind, index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (!drag || drag.kind !== kind) {
      setDrag(null);
      setOver(null);
      return;
    }
    if (kind === "dish") reorderMenuDishes(drag.index, index);
    else reorderMenuLedgers(drag.index, index);
    hapticTap();
    setDrag(null);
    setOver(null);
  };

  const onDragEnd = () => {
    setDrag(null);
    setOver(null);
  };

  const rowClass = (kind: DragKind, index: number) => {
    const parts = ["menu-row"];
    /* pin class added per-row below when kind===dish */
    if (drag?.kind === kind && drag.index === index) parts.push("is-dragging");
    if (over?.kind === kind && over.index === index && drag && drag.index !== index) parts.push("is-drop-target");
    return parts.join(" ");
  };

  return (
    <div className={reveal ? "page tonight-page is-menu-reveal" : "page tonight-page"}>
      {clearConfirm ? (
        <div
          className="clear-confirm-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-tonight-title"
          onClick={() => setClearConfirm(false)}
        >
          <div
            className="clear-confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="clear-tonight-title">清空今晚菜单？</h2>
            <p className="hint">菜会从今晚拿掉；几菜几汤搭配还在。按 Esc 取消。</p>
            <div className="row-btns wrap">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setClearConfirm(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const dishIds = state.menuDishIds.slice();
                  const ledgerIds = state.menuLedgerIds.slice();
                  const { undoToken, note } = clearMenu();
                  setClearConfirm(false);
                  hapticTap();
                  toast("今晚菜单已清空", {
                    ms: 7000,
                    undo: () => {
                      const ok = restoreMenu(dishIds, ledgerIds, note, undoToken);
                      toast(ok ? "已恢复今晚菜单与备忘" : "撤销已失效");
                    },
                  });
                }}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="page-intro tonight-intro">
        <div className="tonight-intro-top">
          <div>
            <p className="eyebrow">摇到的这一桌</p>
            <h1 className="page-title">今晚菜单</h1>
          </div>
          <SyncChip compact />
        </div>
        <RollHistoryChips toast={toast} className="roll-history-tonight" />
        <div className="tonight-meal-summary" role="status">
          <button
            type="button"
            className="tonight-meal-chip"
            onClick={openMeal}
            aria-label="改几菜几汤搭配"
            title="点按改几菜几汤"
          >
            <span className="tonight-meal-k">搭配</span>
            <strong>{mealSummary(state.meal)}</strong>
            <em>
              {mealTotal(state.meal)} 道目标 · 今晚 {menuDishes.length + ledgerEntries.length} 道
            </em>
          </button>
          {(() => {
            const parts = mealProgressParts(menuDishes, state.meal, ledgerEntries.length);
            if (parts.length === 0) return null;
            return (
              <button
                type="button"
                className="tonight-meal-progress"
                onClick={openMeal}
                aria-label="几菜几汤进度，点按修改"
              >
                {parts.map((part) => (
                  <span
                    key={part.id}
                    className={`meal-prog-pill is-${part.tone}`}
                    title={
                      part.id === "ledger"
                        ? `账本 ${part.have} 道`
                        : `${part.short} ${part.have}/${part.want}`
                    }
                  >
                    {part.id === "ledger"
                      ? `${part.short} ${part.have}`
                      : `${part.short} ${part.have}/${part.want}`}
                  </span>
                ))}
              </button>
            );
          })()}
          {(() => {
            const hint = menuVsMealHint(menuDishes.length + ledgerEntries.length, state.meal);
            return hint ? <p className="hint tonight-meal-hint">{hint}</p> : null;
          })()}
        </div>

        <label className="tonight-note">
          <span className="sr-only">今晚备忘</span>
          <textarea
            value={state.tonightNote}
            maxLength={120}
            rows={2}
            placeholder="今晚备忘：谁买菜/几点开做"
            aria-label="今晚备忘，会跟菜单一起同步"
            onChange={(event) => setTonightNote(event.target.value)}
          />
          <span className="tonight-note-count" aria-hidden="true">
            {(state.tonightNote || "").length}/120
          </span>
        </label>
        {(state.tonightNote || "").trim() ? (
          <p className="print-tonight-note" aria-hidden="true">
            备忘：{(state.tonightNote || "").trim()}
          </p>
        ) : null}

        {!empty && menuDishes.length > 0 ? (
          <div className="tonight-unified-servings" role="group" aria-label="统一份数">
            <div className="tonight-unified-head">
              <strong>统一份数</strong>
              <span className="hint">
                应用到今晚每道菜的份数记忆（与详情「按几人」同一套，只记本机；采购预览/打印会按此缩放）
              </span>
            </div>
            <div className="tonight-unified-row">
              <button
                type="button"
                className="icon-btn servings-btn"
                aria-label="减少统一份数"
                disabled={unifiedServings <= MIN_SERVINGS}
                onClick={() => setUnifiedServings((n) => clampServings(n - 1))}
              >
                −
              </button>
              <strong className="servings-value" aria-live="polite">
                <span className="servings-n">{unifiedServings}</span>
                <span className="servings-unit">人</span>
              </strong>
              <button
                type="button"
                className="icon-btn servings-btn"
                aria-label="增加统一份数"
                disabled={unifiedServings >= MAX_SERVINGS}
                onClick={() => setUnifiedServings((n) => clampServings(n + 1))}
              >
                +
              </button>
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => {
                  const ids = menuDishes.map((d) => d.id);
                  const n = applyTonightUnifiedServings(ids, unifiedServings);
                  setUnifiedServings(n);
                  setHasUnified(true);
                  setServingsTick((x) => x + 1);
                  toast(`已把今晚 ${ids.length} 道菜都设为 ${n} 人份`);
                  hapticTap();
                }}
              >
                应用到今晚
              </button>
              {hasUnified ? (
                <button
                  type="button"
                  className="btn-ghost compact"
                  onClick={() => {
                    const ids = menuDishes.map((d) => d.id);
                    const n = clearTonightUnifiedServings(ids);
                    setHasUnified(false);
                    setUnifiedServings(baseServings());
                    setServingsTick((x) => x + 1);
                    toast(n > 0 ? "已恢复各菜自己的份数" : "没有可恢复的份数快照");
                    hapticTap();
                  }}
                >
                  清除恢复
                </button>
              ) : null}
            </div>
            {hasUnified ? (
              <p className="hint tonight-unified-on" role="status">
                当前统一 {loadTonightUnifiedServings() ?? unifiedServings} 人 · 点「清除恢复」回到应用前各菜份数
              </p>
            ) : null}
            <p className="print-servings print-tonight-unified" aria-hidden="true">
              今晚统一按 {hasUnified ? (loadTonightUnifiedServings() ?? unifiedServings) : "各菜自有"} 人份
            </p>
          </div>
        ) : null}
      </header>

      {empty ? (
        <div className="empty tonight-empty">
          <EmptyArt kind="tonight" />
          <strong>今晚还空着</strong>
          <p>先摇一桌，或在下面搜一道加进来。</p>
          <div className="empty-actions tonight-empty-actions">
            <button type="button" className={rolling || rollCooling ? "btn-primary is-roll-cooling" : "btn-primary"} onClick={() => { if (!oncePrimary("roll")) return; rollTonight(); }} disabled={rolling || rollCooling} title={rollCooling ? "稍等一下再摇" : undefined}>
              随机一顿
            </button>
            <button type="button" className="btn-ghost" onClick={openMeal}>
              改几菜几汤
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul
            className={reveal ? "menu-list menu-list-reveal" : "menu-list"}
            aria-label="今晚菜单，可置顶，也可用拖动手柄或上移下移调整顺序"
          >
            {menuDishes.map((dish, index) => {
              const recipe = recipeFor(dish);
              return (
                <li
                  key={dish.id}
                  className={
                    (state.menuPinnedIds || []).includes(dish.id)
                      ? `${rowClass("dish", index)} is-pinned`
                      : rowClass("dish", index)
                  }
                  draggable
                  onDragStart={onDragStart("dish", index)}
                  onDragOver={onDragOver("dish", index)}
                  onDrop={onDrop("dish", index)}
                  onDragEnd={onDragEnd}
                >
                  <button
                    type="button"
                    className="drag-handle"
                    aria-label={`拖动调整「${dish.name}」顺序，也可按↑↓键`}
                    aria-roledescription="可拖动排序手柄"
                    aria-grabbed={drag?.kind === "dish" && drag.index === index}
                    aria-keyshortcuts="ArrowUp ArrowDown"
                    title="按住拖动，或用右侧↑↓／方向键排序"
                    onClick={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        if (index > 0) {
                          moveMenuDish(dish.id, -1);
                          hapticTap();
                        }
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        if (index < menuDishes.length - 1) {
                          moveMenuDish(dish.id, 1);
                          hapticTap();
                        }
                      }
                    }}
                  >
                    <span className="drag-grip" aria-hidden="true">
                      <i /><i /><i />
                    </span>
                  </button>
                  <Link
                    to={`/d/${encodeURIComponent(dish.id)}`}
                    title={dish.name}
                    aria-label={dish.name}
                  >
                    <span className="mini-art">
                      <DishArt name={dish.name} category={dish.category} />
                    </span>
                    <span className="menu-row-copy">
                      <h3 title={dish.name}>{dish.name}</h3>
                      <p>
                        {dish.category} · {recipe.minutes} 分钟 · {recipe.tags[0]}
                      </p>
                    </span>
                  </Link>
                  <div className="menu-row-actions">
                    <button
                      type="button"
                      className={
                        (state.menuPinnedIds || []).includes(dish.id)
                          ? "icon-btn pin-btn is-pinned"
                          : "icon-btn pin-btn"
                      }
                      aria-label={
                        (state.menuPinnedIds || []).includes(dish.id)
                          ? `取消置顶「${dish.name}」`
                          : `置顶「${dish.name}」`
                      }
                      aria-pressed={(state.menuPinnedIds || []).includes(dish.id)}
                      title={(state.menuPinnedIds || []).includes(dish.id) ? "取消置顶" : "置顶"}
                      onClick={() => {
                        const was = (state.menuPinnedIds || []).includes(dish.id);
                        toggleMenuDishPin(dish.id);
                        hapticTap();
                        toast(was ? `已取消置顶「${dish.name}」` : `已置顶「${dish.name}」`, {
                          ms: 2200,
                        });
                      }}
                    >
                      <span aria-hidden="true">📌</span>
                      <span className="sr-only">置顶</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn move-btn"
                      aria-label={`上移「${dish.name}」`}
                      title="上移"
                      disabled={index === 0}
                      onClick={() => {
                        moveMenuDish(dish.id, -1);
                        hapticTap();
                      }}
                    >
                      <span aria-hidden="true">↑</span>
                      <span className="sr-only">上移</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn move-btn"
                      aria-label={`下移「${dish.name}」`}
                      title="下移"
                      disabled={index >= menuDishes.length - 1}
                      onClick={() => {
                        moveMenuDish(dish.id, 1);
                        hapticTap();
                      }}
                    >
                      <span aria-hidden="true">↓</span>
                      <span className="sr-only">下移</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`移出 ${dish.name}`}
                      onClick={() => {
                        const snap = removeDishFromMenu(dish.id);
                        if (!snap) return;
                        hapticTap();
                        toast(`已移出「${dish.name}」`, {
                          ms: 7000,
                          undo: () => {
                            const ok = insertDishAtMenu(dish.id, snap.index, snap.undoToken);
                            toast(ok ? `已恢复「${dish.name}」` : "撤销已失效");
                          },
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
            {ledgerEntries.map((entry, index) => (
              <li
                key={entry.id}
                className={rowClass("ledger", index)}
                draggable
                onDragStart={onDragStart("ledger", index)}
                onDragOver={onDragOver("ledger", index)}
                onDrop={onDrop("ledger", index)}
                onDragEnd={onDragEnd}
              >
                <button
                  type="button"
                  className="drag-handle"
                  aria-label={`拖动调整「${entry.name}」顺序，也可按↑↓键`}
                  aria-roledescription="可拖动排序手柄"
                  aria-grabbed={drag?.kind === "ledger" && drag.index === index}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  title="按住拖动，或用右侧↑↓／方向键排序"
                  onClick={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (index > 0) {
                        moveMenuLedger(entry.id, -1);
                        hapticTap();
                      }
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (index < ledgerEntries.length - 1) {
                        moveMenuLedger(entry.id, 1);
                        hapticTap();
                      }
                    }
                  }}
                >
                  <span className="drag-grip" aria-hidden="true">
                    <i /><i /><i />
                  </span>
                </button>
                <Link to={`/ledger/${entry.id}`}>
                  <span className="mini-art">
                    {entry.image ? (
                      <img src={entry.image} alt="" />
                    ) : (
                      <DishArt name={entry.name.trim() || "家常菜"} category="家常热菜" />
                    )}
                  </span>
                  <span className="menu-row-copy">
                    <h3 title={entry.name}>{entry.name}</h3>
                    <p>我们的账本</p>
                  </span>
                </Link>
                <div className="menu-row-actions">
                  <button
                    type="button"
                    className="icon-btn move-btn"
                    aria-label={`上移「${entry.name}」`}
                    title="上移"
                    disabled={index === 0}
                    onClick={() => {
                      moveMenuLedger(entry.id, -1);
                      hapticTap();
                    }}
                  >
                    <span aria-hidden="true">↑</span>
                    <span className="sr-only">上移</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn move-btn"
                    aria-label={`下移「${entry.name}」`}
                    title="下移"
                    disabled={index >= ledgerEntries.length - 1}
                    onClick={() => {
                      moveMenuLedger(entry.id, 1);
                      hapticTap();
                    }}
                  >
                    <span aria-hidden="true">↓</span>
                    <span className="sr-only">下移</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`移出 ${entry.name}`}
                    onClick={() => {
                      const snap = removeLedgerFromMenu(entry.id);
                      if (!snap) return;
                      hapticTap();
                      toast(`已移出「${entry.name}」`, {
                        ms: 7000,
                        undo: () => {
                          const ok = insertLedgerAtMenu(entry.id, snap.index, snap.undoToken);
                          toast(ok ? `已恢复「${entry.name}」` : "撤销已失效");
                        },
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint reorder-hint" id="tonight-reorder-hint">
            <span className="reorder-hint-mark" aria-hidden="true">⋮⋮</span>
            按住左侧手柄拖动，或点右侧上移 / 下移（键盘 ↑↓）；顺序会写入今晚菜单并跟情侣同步。几菜几汤搭配不受影响。
          </p>
          <div className="stack">
            <Link className="btn-primary block" to="/list" title="打开采购清单；盒马按钮仅搜索，不是一键加购">
              去买菜
            </Link>
            <div className="tonight-secondary-row">
              <button
                type="button"
                className={
                  rolling || rollCooling
                    ? "btn-secondary btn-reroll is-roll-cooling"
                    : "btn-secondary btn-reroll"
                }
                onClick={() => { if (!oncePrimary("roll")) return; rollTonight(); }}
                disabled={rolling || rollCooling}
                title={rollCooling ? "稍等一下再摇" : undefined}
              >
                再来一次
              </button>
              <button
                type="button"
                className={
                  rolling || rollCooling
                    ? "btn-ghost btn-reject-reroll is-roll-cooling"
                    : "btn-ghost btn-reject-reroll"
                }
                onClick={() => {
                  if (!oncePrimary("reject-roll")) return;
                  rejectTonightAndReroll();
                  setRejectTick((n) => n + 1);
                }}
                disabled={rolling || rollCooling || menuDishes.length === 0}
                title="把本批结果临时排除约 30 分钟，再摇时避开（可与避开已选叠加）"
              >
                不要这些，再摇
              </button>
              {rejectCount > 0 ? (
                <button
                  type="button"
                  className="btn-ghost btn-clear-rejects"
                  onClick={() => {
                    const n = clearTempRollRejects();
                    setRejectTick((x) => x + 1);
                    hapticTap();
                    toast(
                      n > 0
                        ? `已清除 ${n} 道临时排除（今晚/最近排除不动）`
                        : "没有临时排除",
                      { ms: 2800 },
                    );
                  }}
                  title="只清除「不要这些」的短期排除；不影响「避开已选 / 最近」"
                >
                  清除临时排除（{rejectCount}）
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary btn-tonight-ledger"
                onClick={recordTonightToLedger}
                title="把今晚菜单记成一条账本（菜名+日期+主料）"
              >
                记入账本
              </button>
              <button
                type="button"
                className="btn-secondary btn-export-tonight"
                onClick={() => { if (!oncePrimary("export-menu")) return; void exportMenu(); }}
                title="复制：搭配 + 备忘 + 菜名 + 食材 + 合并采购摘要"
              >
                导出菜单
              </button>
              <button
                type="button"
                className="btn-ghost btn-print-tonight"
                onClick={() => {
                  if (!oncePrimary("print-tonight")) return;
                  window.print();
                }}
                title="打印今晚菜单（含备忘）"
              >
                打印
              </button>
              <button
                type="button"
                className="btn-secondary btn-share-tonight"
                onClick={() => void shareTonight()}
                title="分享：几菜几汤 + 菜名 + 食材速览 + 应用链接"
              >
                分享
              </button>
            </div>
            <p className="hint reroll-hint">
              不满意就再摇——仍偏向「精修」。「不要这些」会短期临时排除本批（约 30 分钟，有上限），再摇时避开；可一键清除临时排除（不影响「避开已选 / 最近」）。
              {rejectCount > 0 ? `当前${rollRejectHint() || ("临时排除 " + rejectCount + " 道")}。` : ""}
              {rollExclude ? "已叠加避开今晚已有与最近看过的菜；不够会放宽。" : "当前未开「避开已选 / 最近」。"}
              {rollLedgerExclude ? `已避开账本近 ${rollLedgerDays} 天做过的菜。` : ""}
            </p>
            <label className="roll-exclude-toggle is-inline">
              <input
                type="checkbox"
                checked={rollExclude}
                onChange={(event) => setRollExclude(event.target.checked)}
              />
              <span>避开已选 / 最近</span>
            </label>
            <label className="roll-exclude-toggle is-inline">
              <input
                type="checkbox"
                checked={rollLedgerExclude}
                onChange={(event) => setRollLedgerExclude(event.target.checked)}
              />
              <span>避开账本近几天</span>
            </label>
            {rollLedgerExclude ? (
              <div className="roll-ledger-days is-inline" role="group" aria-label="避开账本天数">
                {([3, 7, 14] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={rollLedgerDays === d ? "chip on" : "chip"}
                    aria-pressed={rollLedgerDays === d}
                    onClick={() => setRollLedgerDays(d)}
                  >
                    {d} 天
                  </button>
                ))}
              </div>
            ) : null}
            <div className="row-btns tonight-primary-row">
              <button type="button" className="btn-ghost" onClick={openMeal}>
                改搭配
              </button>
              <button
                type="button"
                className={showMerged ? "btn-secondary" : "btn-ghost"}
                aria-pressed={showMerged}
                onClick={() => {
                  setShowMerged((v) => !v);
                  hapticTap();
                }}
              >
                合并购物清单
              </button>
              <div className="more-menu tonight-more">
                <button
                  type="button"
                  className={tonightMore ? "btn-ghost more-toggle is-on" : "btn-ghost more-toggle"}
                  aria-expanded={tonightMore}
                  aria-haspopup="menu"
                  onClick={() => setTonightMore((v) => !v)}
                >
                  更多
                </button>
                {tonightMore ? (
                  <div className="more-pop" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="more-item"
                      onClick={() => {
                        setTonightMore(false);
                        void copyTonightIngredients();
                      }}
                    >
                      复制食材
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="more-item"
                      onClick={() => {
                        setTonightMore(false);
                        void shareTonight();
                      }}
                    >
                      分享今晚
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="more-item"
                      onClick={() => {
                        setTonightMore(false);
                        void shareTonightIngredients();
                      }}
                    >
                      分享食材
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="more-item danger"
                      onClick={() => {
                        setTonightMore(false);
                        setClearConfirm(true);
                      }}
                    >
                      清空菜单
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {showMerged && (
              <section className="panel merged-shop" aria-label="合并购物清单">
                <div className="block-head">
                  <h2 className="block-title" style={{ margin: 0 }}>
                    合并购物清单
                  </h2>
                  <button type="button" className="btn-ghost compact" onClick={() => void copyMergedList()}>
                    一键复制
                  </button>
                </div>
                <p className="hint">
                  同名食材已合并；能量化的用量相加，否则并列写出。「在盒马搜」只是搜索，不是一键加购。
                  {servingsScaled ? " 用量按详情份数。" : ""}
                </p>
                {mergedLines.length === 0 ? (
                  <p className="hint">这桌还没有可解析的食材。</p>
                ) : (
                  <>
                    <ul className="merged-list">
                      {mergedLines.map((line) => (
                        <li
                          key={`${line.role}-${line.name}`}
                          className={line.role === "seasoning" ? "is-seasoning" : undefined}
                        >
                          <span className="merged-name">{line.name}</span>
                          <span className="merged-amt">{line.amount || "—"}</span>
                          {line.merged && line.sources.length > 1 ? (
                            <span className="merged-src">{line.sources.join(" · ")}</span>
                          ) : null}
                          <button
                            type="button"
                            className="hema-btn compact merged-hema"
                            title={`在盒马搜「${hemaSearchTerm(line.name) || line.name}」· 不是一键加购`}
                            onClick={() => openHema(line.name, state.hemaTemplate, toast)}
                          >
                            <span className="hema-btn-main">盒马搜</span>
                            <span className="hema-btn-q">
                              {hemaSearchTerm(line.name) || line.name}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="hema-keyword-preview" aria-label="盒马关键词预览">
                      {hemaKeywords(mergedLines.map((line) => line.name))
                        .slice(0, 10)
                        .map((term) => (
                          <span key={term} className="chip hema-kw-chip is-static">
                            {term}
                          </span>
                        ))}
                    </div>
                    <div className="row-btns wrap hema-multi-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          const terms = hemaKeywords(mergedLines.map((line) => line.name));
                          if (terms.length === 0) {
                            toast("没有可搜的食材");
                            return;
                          }
                          if (!isOnline()) {
                            toast("需要联网才能打开盒马搜索");
                            return;
                          }
                          openHema(terms[0]!, state.hemaTemplate, toast);
                          toast(
                            terms.length > 1
                              ? `已开第 1/${terms.length}：${terms[0]} · 其余可点关键词或去采购页逐条搜`
                              : `正在搜「${terms[0]}」`,
                          );
                        }}
                      >
                        逐条在盒马搜
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() =>
                          void copyHemaKeywords(
                            mergedLines.map((line) => line.name),
                            toast,
                          )
                        }
                      >
                        复制全部关键词
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}

      <section className="panel tonight-pick">
        <h2>加一道</h2>
        <p className="hint">九百多道菜，先搜名字再放进今晚，不用整表翻。</p>
        <label className="search">
          <SearchIcon />
          <input
            value={pickQuery}
            onChange={(event) => setPickQuery(event.target.value)}
            placeholder="搜菜名"
            enterKeyHint="search"
            aria-label="搜索并加入今晚"
          />
          {pickQuery.length > 0 ? (
            <button type="button" className="clear-btn is-visible" onClick={() => setPickQuery("")} aria-label="清除搜索">
              ×
            </button>
          ) : null}
        </label>
        {pickNeedle && pickHits.length === 0 && (
          <p className="hint">菜单里暂时没有「{pickNeedle}」。换个词，或去账本手写一道专属的。</p>
        )}
        {pickHits.length > 0 && (
          <ul className="pick-list">
            {pickHits.map((dish) => (
              <li key={dish.id}>
                <button
                  type="button"
                  className="pick-row"
                  onClick={() => {
                    const added = addDishToMenu(dish.id);
                    hapticTap();
                    if (added) {
                      toast(`「${dish.name}」放进今晚了`);
                      setPickQuery("");
                    } else {
                      toast("已在今晚", { ms: 4800 });
                    }
                  }}
                >
                  <span className="mini-art">
                    <DishArt name={dish.name} category={dish.category} />
                  </span>
                  <span>
                    <strong title={dish.name}>{dish.name}</strong>
                    <small>{dish.category}</small>
                  </span>
                  <span className="pick-add">加入</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
