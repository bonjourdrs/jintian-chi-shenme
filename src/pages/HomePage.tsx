import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BasketArt, CatLine, CatPaint, CoupleMark, Die, DishArt, EmptyArt } from "../components/Art.tsx";
import { DishCard } from "../components/DishCard.tsx";
import { firstRowPriorityCount } from "../lib/coverPriority.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import { DishGridSkeleton } from "../components/DishGridSkeleton.tsx";
import { RollHistoryChips } from "../components/RollHistoryChips.tsx";
import { ChevronIcon, SearchIcon } from "../components/Icons.tsx";
import { Sheet } from "../components/Sheet.tsx";
import { SyncChip } from "../components/SyncChip.tsx";
import { ThemeButton } from "../components/ThemeSheet.tsx";
import { categories, dishById, featuredDishes, searchDishes } from "../data/catalog.ts";
import { recipeFor } from "../data/recipes.ts";
import { loadRefinedOnly, saveRefinedOnly } from "../lib/refinedOnly.ts";
import { hapticTap } from "../lib/haptics.ts";
import { mealSummary } from "../lib/meal.ts";
import { dayOfYear } from "../lib/random.ts";
import { clearRecent, loadRecent, type RecentDish } from "../lib/recent.ts";
import {
  clearSearchHistory,
  removeSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
} from "../lib/searchHistory.ts";
import { useTitle } from "../lib/useTitle.ts";
import { useApp } from "../state/store.tsx";
import { themeCopy } from "../theme/themes.ts";
import type { Dish } from "../types.ts";

export function HomePage() {
  const navigate = useNavigate();
  useTitle();
  const { state, menuDishes, openMeal, rollTonight, rolling, rollCooling, addDishesToMenu, toast, rollExclude } = useApp();
  const copy = themeCopy(state.theme);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentDish[]>(() => loadRecent());
  const [searchHist, setSearchHist] = useState<string[]>(() => loadSearchHistory());
  const [clearRecentOpen, setClearRecentOpen] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const [refinedOnly, setRefinedOnly] = useState(() => loadRefinedOnly());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const lastSelectRef = useRef<string | null>(null);
  const [isDesk, setIsDesk] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 880px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 880px)");
    const sync = () => {
      setIsDesk(mq.matches);
      if (!mq.matches) {
        setSelectMode(false);
        setSelected([]);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onClear = () => setQuery("");
    window.addEventListener("jte-clear-search", onClear);
    return () => window.removeEventListener("jte-clear-search", onClear);
  }, []);
  const [priorityCount, setPriorityCount] = useState(() => firstRowPriorityCount());
  useEffect(() => {
    const sync = () => setPriorityCount(firstRowPriorityCount());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);


  useEffect(() => {
    let alive = true;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (alive) {
          setHomeReady(true);
          try {
            window.dispatchEvent(new Event("jte-app-painted"));
          } catch {
            /* ignore */
          }
        }
      });
    });
    return () => {
      alive = false;
      window.cancelAnimationFrame(id);
    };
  }, []);
  const [showThemeTip, setShowThemeTip] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("jte-theme-tip-dismissed") !== "1";
    } catch {
      return false;
    }
  });
  const dismissThemeTip = () => {
    try {
      window.localStorage.setItem("jte-theme-tip-dismissed", "1");
    } catch {
      /* ignore */
    }
    setShowThemeTip(false);
  };
  const [showStripHint, setShowStripHint] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("jte-strip-hint-seen") !== "1";
    } catch {
      return false;
    }
  });
  const dismissStripHint = useCallback(() => {
    setShowStripHint((prev) => {
      if (!prev) return prev;
      try {
        window.localStorage.setItem("jte-strip-hint-seen", "1");
      } catch {
        /* ignore */
      }
      return false;
    });
  }, []);
  const onStripScroll = useCallback(() => {
    dismissStripHint();
  }, [dismissStripHint]);
  const featured = useMemo(() => featuredDishes(), []);
  const needle = query.trim();
  const results = useMemo(() => {
    const pool = needle ? searchDishes(needle) : featured;
    if (!refinedOnly) return pool;
    return pool.filter((dish) => recipeFor(dish).fromOverride);
  }, [needle, featured, refinedOnly]);
  const shown = needle ? results.slice(0, 8) : results;
  const menuCount = menuDishes.length + state.menuLedgerIds.length;
  const vol = String(dayOfYear()).padStart(3, "0");
  const wantDishes = useMemo(
    () =>
      state.hearts
        .map((id) => dishById.get(id))
        .filter((dish): dish is Dish => Boolean(dish)),
    [state.hearts],
  );
  const addWantsToTonight = () => {
    const MAX = 8;
    const ids = wantDishes.slice(0, MAX).map((d) => d.id);
    const { added, skipped } = addDishesToMenu(ids);
    const extra = wantDishes.length > MAX ? wantDishes.length - MAX : 0;
    if (added === 0) {
      toast(skipped > 0 ? "想吃的都已在今晚" : "没有可加入的菜", {
        ms: 5200,
        ...(skipped > 0
          ? { actionLabel: "去看看", undo: () => navigate("/tonight") }
          : {}),
      });
      return;
    }
    hapticTap();
    const bits = [`已把 ${added} 道想吃加入今晚`];
    if (skipped) bits.push(`跳过 ${skipped} 道已在菜单`);
    if (extra) bits.push(`其余 ${extra} 道下次再加`);
    toast(bits.join(" · "), {
      ms: 5200,
      ...(skipped > 0
        ? { actionLabel: "去看看", undo: () => navigate("/tonight") }
        : {}),
    });
  };

  const recentDishes = recent
    .map((item) => dishById.get(item.id))
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
  const firstStripKey =
    menuCount > 0 ? "tonight" : wantDishes.length > 0 ? "want" : recentDishes.length > 0 ? "recent" : null;

  const renderStripHint = (key: string) =>
    showStripHint && firstStripKey === key ? (
      <div className={showStripHint ? "strip-hint is-on" : "strip-hint"} role="status" aria-live="polite">
        <div className="strip-hint-arrows" aria-hidden="true">
          <span>‹</span>
          <span>›</span>
        </div>
        <button type="button" className="strip-hint-pill" onClick={dismissStripHint}>
          左右滑看看
        </button>
      </div>
    ) : null;

  const commitSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setSearchHist(pushSearchHistory(q));
  };

  useEffect(() => {
    const onRefresh = () => {
      setRecent(loadRecent());
      setSearchHist(loadSearchHistory());
    };
    window.addEventListener("jte-refresh", onRefresh);
    return () => window.removeEventListener("jte-refresh", onRefresh);
  }, []);

  const toggleSelect = (id: string, shiftKey: boolean) => {
    setSelected((prev) => {
      const order = shown.map((d) => d.id);
      if (shiftKey && lastSelectRef.current && order.includes(lastSelectRef.current)) {
        const a = order.indexOf(lastSelectRef.current);
        const b = order.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          const range = order.slice(lo, hi + 1);
          const next = new Set(prev);
          for (const x of range) next.add(x);
          return [...next];
        }
      }
      lastSelectRef.current = id;
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const addSelectedToTonight = () => {
    if (selected.length === 0) {
      toast("先勾几道菜");
      return;
    }
    const { added, skipped } = addDishesToMenu(selected);
    if (added === 0) {
      toast(skipped > 0 ? "勾选的都已在今晚" : "没有可加入的菜", {
        ms: 5200,
        ...(skipped > 0
          ? { actionLabel: "去看看", undo: () => navigate("/tonight") }
          : {}),
      });
    } else {
      const bits = [`已把 ${added} 道加入今晚`];
      if (skipped) bits.push(`跳过 ${skipped} 道已在菜单`);
      toast(bits.join(" · "), {
        ms: 5200,
        ...(skipped > 0
          ? { actionLabel: "去看看", undo: () => navigate("/tonight") }
          : {}),
      });
    }
    setSelected([]);
    setSelectMode(false);
    hapticTap();
  };


  return (
    <div className="page home">
      <header className="home-top">
        <div className="brand">
          {copy.eyebrow && (
            <p className="eyebrow">
              <span>{copy.eyebrow}</span>
              {state.theme === "midnight-magazine" && <span className="vol">VOL. {vol}</span>}
            </p>
          )}
          <h1>今天吃什么</h1>
          <p className="tagline">
            {copy.tagline} <span className="tag-heart">♥</span>
          </p>
        </div>
        <div className="home-actions">
          <ThemeButton />
          <Link className="ledger-chip" to="/ledger">
            <CoupleMark />
            <span>我们的账本</span>
            <ChevronIcon />
          </Link>
        </div>
      </header>

      {showThemeTip && (
        <aside className="theme-tip" role="status">
          <p>右上角四色圆点可以换皮肤：咖啡馆、黑板报、菜市折页、午夜杂志，选了会记在这台设备上。</p>
          <button type="button" className="linkish" onClick={dismissThemeTip}>
            知道了
          </button>
        </aside>
      )}

      <label className="search">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitSearch(query);
          }}
          placeholder={copy.search}
          enterKeyHint="search"
          aria-label="搜索菜名"
        />
        {query.length > 0 ? (
          <button
            type="button"
            className="clear-btn is-visible"
            onClick={() => {
              setQuery("");
            }}
            aria-label="清除搜索"
          >
            ×
          </button>
        ) : null}
      </label>

      {!needle && searchHist.length > 0 && (
        <div className="search-history" aria-label="最近搜索（仅本机）">
          <p className="search-hist-label">最近搜过</p>
          <div className="chips-fade search-hist-fade">
            <div className="chips search-hist-chips">
              {searchHist.map((item) => (
                <span key={item} className="search-hist-item">
                  <button
                    type="button"
                    className="chip search-hist-chip"
                    onClick={() => {
                      setQuery(item);
                      commitSearch(item);
                      hapticTap();
                    }}
                  >
                    {item}
                  </button>
                  <button
                    type="button"
                    className="search-hist-remove"
                    aria-label={`删除搜索「${item}」`}
                    title="删除这条"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSearchHist(removeSearchHistory(item));
                      hapticTap();
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="see-all linkish search-hist-clear"
            onClick={() => {
              clearSearchHistory();
              setSearchHist([]);
              setQuery("");
              toast("已清空搜索历史");
              hapticTap();
            }}
          >
            清空
          </button>
        </div>
      )}

      {!needle && searchHist.length === 0 && (
        <p className="search-tip">试试搜「番茄」或分类名，比如「海鲜」</p>
      )}

      {!homeReady && !needle ? (
        <div className="home-cold-skeleton" aria-busy="true" aria-label="首页加载中">
          <div className="cat-skel-row">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="cat-skel" />
            ))}
          </div>
          <DishGridSkeleton count={8} className="is-home-grid" label="加载首页" />
        </div>
      ) : (
      <>
      <nav className="cat-grid" aria-label="分类">
        {categories.map((category) => (
          <Link
            key={category.id}
            className={`cat motif-${category.motif}`}
            to={`/c/${encodeURIComponent(category.id)}`}
            aria-label={`${category.id}，${category.count}道`}
          >
            <span className="cat-paint">
              <CatPaint motif={category.motif} label={category.short} />
            </span>
            <span className="cat-line">
              <CatLine motif={category.motif} />
            </span>
            <span className="cat-name">{category.short}</span>
          </Link>
        ))}
      </nav>

      {!needle ? <RollHistoryChips toast={toast} /> : null}

      {!needle && menuCount > 0 && (
        <section className="recent-section tonight-section" aria-label="今晚吃">
          <div className="section-head">
            <h2>今晚吃{menuCount > 0 ? ` · ${menuCount}` : ""}</h2>
            <div className="section-head-aside">
              <SyncChip compact />
              <Link className="see-all" to="/tonight">
                全部
              </Link>
            </div>
          </div>
          <div className="strip-fade strip-hint-wrap">
            {renderStripHint("tonight")}
            <div className="recent-strip" onScroll={onStripScroll}>
            {menuDishes.map((dish, index) => (
              <Link key={dish.id} className="recent-card" to={`/d/${encodeURIComponent(dish.id)}`}>
                <span className="recent-art">
                  <DishArt name={dish.name} category={dish.category} priority={index < 2} lazy={index >= 2} />
                </span>
                <span className="recent-name" title={dish.name}>{dish.name}</span>
              </Link>
            ))}
            {state.menuLedgerIds.map((id) => {
              const entry = state.ledger.find((item) => item.id === id);
              if (!entry) return null;
              const name = entry.name.trim() || "家常菜";
              return (
                <Link key={id} className="recent-card" to={`/ledger/${encodeURIComponent(id)}`}>
                  <span className="recent-art">
                    <DishArt name={name} category="家常热菜" />
                  </span>
                  <span className="recent-name" title={name}>{name}</span>
                </Link>
              );
            })}
          </div></div>
        </section>
      )}

      {!needle && wantDishes.length > 0 && (
        <section className="recent-section want-section" aria-label="想吃">
          <p className="hint sync-scope-line">
            想吃会随房间同步；今晚、账本与皮肤也会同步。采购勾选只留本机。
            <Link className="linkish" to="/us">
              去「我们」
            </Link>
          </p>
          <div className="section-head">
            <h2>
              想吃
              {wantDishes.length > 0 ? (
                <em className="count-chip" aria-label={`想吃 ${wantDishes.length} 道`}>
                  想吃 {wantDishes.length}
                </em>
              ) : null}
            </h2>
            <Link className="see-all" to="/us">
              全部
            </Link>
          </div>
          <div className="want-to-tonight-inline">
            <button type="button" className="btn-secondary" onClick={addWantsToTonight}>
              一键加入今晚
            </button>
          </div>
          <div className="strip-fade strip-hint-wrap">
            {renderStripHint("want")}
            <div className="recent-strip" onScroll={onStripScroll}>
            {wantDishes.slice(0, 12).map((dish) => (
              <Link key={dish.id} className="recent-card" to={`/d/${encodeURIComponent(dish.id)}`}>
                <span className="recent-art">
                  <DishArt name={dish.name} category={dish.category} />
                </span>
                <span className="recent-name" title={dish.name}>{dish.name}</span>
              </Link>
            ))}
          </div></div>
        </section>
      )}

      {!needle && (
        <section className="recent-section" aria-label="最近看过">
          <div className="section-head">
            <h2>最近看过{recentDishes.length > 0 ? ` · ${recentDishes.length}` : ""}</h2>
            {recentDishes.length > 0 ? (
              <button
                type="button"
                className="see-all linkish"
                onClick={() => setClearRecentOpen(true)}
              >
                清空
              </button>
            ) : null}
          </div>
          {recentDishes.length === 0 ? (
            <div className="empty recent-empty">
              <EmptyArt kind="search" />
              <strong>还没有看过的菜</strong>
              <p>点开一道菜，就会留在这里，方便回看。</p>
              <div className="empty-actions">
                <Link className="btn-primary" to="/browse">
                  去翻菜单
                </Link>
              </div>
            </div>
          ) : (
            <div className="strip-fade strip-hint-wrap">
              {renderStripHint("recent")}
              <div className="recent-strip" onScroll={onStripScroll}>
                {recentDishes.map((dish) => (
                  <Link
                    key={dish.id}
                    className="recent-card"
                    to={`/d/${encodeURIComponent(dish.id)}`}
                    title={`打开「${dish.name}」`}
                  >
                    <span className="recent-art">
                      <DishArt name={dish.name} category={dish.category} />
                    </span>
                    <span className="recent-name" title={dish.name}>{dish.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="home-featured-section">
        <div className="browse-filter-sticky home-filter-sticky" role="group" aria-label="筛选">
          <button
            type="button"
            className={refinedOnly ? "chip on browse-refine-chip" : "chip browse-refine-chip"}
            aria-pressed={refinedOnly}
            title="只看有精修菜谱的菜"
            onClick={() => {
              const next = !refinedOnly;
              setRefinedOnly(next);
              saveRefinedOnly(next);
              hapticTap();
            }}
          >
            有精修
          </button>
          <div className="section-head home-filter-head">
            <h2>{needle ? `搜到 ${results.length} 道` : copy.featured}</h2>
            <Link className="see-all" to={needle ? `/browse?q=${encodeURIComponent(needle)}` : "/browse"}>
              {needle && results.length > shown.length ? "查看全部结果" : copy.seeAll}
            </Link>
          </div>
        </div>
        {results.length === 0 ? (
          <div className="empty search-empty">
            <EmptyArt kind="search" />
            <strong>
              {needle
                ? `没搜到「${needle}」`
                : refinedOnly
                  ? "这边没有精修菜"
                  : "暂时没有菜"}
            </strong>
            <p>
              {refinedOnly
                ? "关掉「有精修」或换个分类/关键词再看看。"
                : "换个词试试，或去翻分类、摇一桌碰运气。"}
            </p>
            <div className="empty-actions">
              {refinedOnly || needle ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (refinedOnly) {
                      setRefinedOnly(false);
                      saveRefinedOnly(false);
                    }
                    if (needle) setQuery("");
                    hapticTap();
                  }}
                >
                  清除筛选
                </button>
              ) : null}
              <Link className="btn-ghost" to="/browse">
                去翻菜单
              </Link>
            </div>
          </div>
        ) : !homeReady ? (
          <DishGridSkeleton count={needle ? Math.min(8, Math.max(4, shown.length || 4)) : 8} className="is-home-grid" />
        ) : (
          <>
            {isDesk ? (
              <div className="desk-multi-bar" role="toolbar" aria-label="桌面多选">
                {!selectMode ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setSelectMode(true);
                      setSelected([]);
                    }}
                  >
                    多选加入今晚
                  </button>
                ) : (
                  <>
                    <span className="desk-multi-count">已选 {selected.length}</span>
                    <button type="button" className="btn-primary" onClick={addSelectedToTonight} disabled={selected.length === 0}>
                      加入今晚
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setSelectMode(false);
                        setSelected([]);
                      }}
                    >
                      取消
                    </button>
                    <em className="hint desk-multi-hint">点选 · Shift 连选</em>
                  </>
                )}
              </div>
            ) : null}
            <div className="dish-grid is-home-grid is-cards-ready">
              {shown.map((dish, index) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  highlight={needle || undefined}
                  onOpen={needle ? () => commitSearch(needle) : undefined}
                  priority={!needle && index < priorityCount}
                  selectMode={selectMode && isDesk}
                  selected={selected.includes(dish.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          </>
        )}
      </section>

      </>
      )}

      <button type="button" className={rolling || rollCooling ? "random-banner is-roll-cooling" : "random-banner"} onClick={() => { if (!oncePrimary("roll")) return; rollTonight(); }} disabled={rolling || rollCooling} title={rollCooling ? "稍等一下再摇" : undefined}>
        <span className="dice-mini" aria-hidden="true">
          <Die pips={2} />
          <Die pips={5} />
        </span>
        <span className="stamp">{menuCount > 0 ? "再摇" : "今日特价"}</span>
        <span className="banner-copy">
          <strong className="banner-title">{menuCount > 0 ? "再来一次" : copy.randomTitle}</strong>
          <span className="banner-sub">
            {menuCount > 0
              ? "避开今晚这桌；精修菜会多摇到一些"
              : copy.randomSub}
          </span>
        </span>
        <ChevronIcon />
      </button>
      <p className="roll-bias-hint" role="note">
        随机会偏向「精修」菜谱
        {rollExclude ? "，并默认避开今晚已有与最近看过的菜" : ""}。
      </p>
      <div className="home-sync-row">
        <SyncChip />
      </div>
      <button type="button" className="meal-line" onClick={openMeal}>
        几菜几汤 · {mealSummary(state.meal)}
      </button>

      <Link className="shop-strip" to="/list">
        <BasketArt />
        <span className="shop-strip-title">采购清单</span>
        <span className="shop-strip-meta">去盒马</span>
        <ChevronIcon />
      </Link>
      <Sheet compact open={clearRecentOpen} title="清空最近看过？" onClose={() => setClearRecentOpen(false)}>
        <p className="hint" style={{ marginTop: 0 }}>
          再确认一次：只会清掉本机「最近看过」，想吃和今晚菜单不受影响。此操作不能撤销。
        </p>
        <div className="row-btns" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              clearRecent();
              setRecent([]);
              setClearRecentOpen(false);
              hapticTap();
              toast("已清空最近看过");
            }}
          >
            确认清空
          </button>
          <button type="button" className="btn-ghost" onClick={() => setClearRecentOpen(false)}>
            先留着
          </button>
        </div>
      </Sheet>

    </div>
  );
}
