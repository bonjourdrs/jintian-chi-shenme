import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CatPaint, EmptyArt } from "../components/Art.tsx";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DishCard } from "../components/DishCard.tsx";
import { ChipsFade } from "../components/ChipsFade.tsx";
import { firstRowPriorityCount } from "../lib/coverPriority.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import { DishGridSkeleton } from "../components/DishGridSkeleton.tsx";
import { BackIcon, SearchIcon } from "../components/Icons.tsx";
import { ThemeButton } from "../components/ThemeSheet.tsx";
import { categories, dishes, dishesIn, searchDishes, sortDishes, type DishSortMode } from "../data/catalog.ts";
import { recipeFor } from "../data/recipes.ts";
import { loadRefinedOnly, saveRefinedOnly } from "../lib/refinedOnly.ts";
import { useTitle } from "../lib/useTitle.ts";
import {
  clearSearchHistory,
  removeSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
} from "../lib/searchHistory.ts";
import { hapticTap } from "../lib/haptics.ts";
import { useApp } from "../state/store.tsx";

/** Initial visible cards; categories with more use「加载更多」. */
const PAGE_SIZE = 40;

const SORT_OPTIONS: { id: DishSortMode; label: string; hint: string }[] = [
  { id: "default", label: "默认", hint: "按菜单收录顺序" },
  { id: "hot", label: "点赞高", hint: "按样例视频的人气排" },
  { id: "name", label: "名字", hint: "按菜名排" },
];

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function DishListPage() {
  const { rollTonight, rolling, rollCooling, addDishesToMenu, toast } = useApp();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = params.category ? safeDecode(params.category) : "";
  const query = searchParams.get("q") ?? "";
  const [sort, setSort] = useState<DishSortMode>("default");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  /** Brief skeleton while category / sort / query identity flips (data is sync — keep it short). */
  const [listPending, setListPending] = useState(true);
  const [searchHist, setSearchHist] = useState<string[]>(() => loadSearchHistory());
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
    const onRefresh = () => setRefreshNonce((n) => n + 1);
    window.addEventListener("jte-refresh", onRefresh);
    return () => window.removeEventListener("jte-refresh", onRefresh);
  }, []);

  useEffect(() => {
    const onClear = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("q");
          return next;
        },
        { replace: true },
      );
    };
    window.addEventListener("jte-clear-search", onClear);
    return () => window.removeEventListener("jte-clear-search", onClear);
  }, [setSearchParams]);

  const [priorityCount, setPriorityCount] = useState(() => firstRowPriorityCount());
  useEffect(() => {
    const sync = () => setPriorityCount(firstRowPriorityCount());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const known = categories.some((item) => item.id === category);

  const base = useMemo(() => {
    let pool;
    if (category) {
      pool = dishesIn(category);
      const needle = query.trim().toLowerCase();
      if (needle) pool = pool.filter((dish) => dish.name.toLowerCase().includes(needle));
    } else if (query.trim()) {
      pool = searchDishes(query);
    } else {
      pool = dishes;
    }
    if (refinedOnly) pool = pool.filter((dish) => recipeFor(dish).fromOverride);
    return pool;
  }, [category, query, refinedOnly]);

  const ordered = useMemo(() => sortDishes(base, sort), [base, sort]);
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [category, query, sort, refinedOnly]);

  useLayoutEffect(() => {
    setListPending(true);
    let alive = true;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (alive) setListPending(false);
      });
    });
    return () => {
      alive = false;
      window.cancelAnimationFrame(id);
    };
  }, [category, query, sort]);
  const title = category || (query.trim() ? `搜索「${query.trim()}」` : "全部菜");
  useTitle(title);
  const sortMeta = SORT_OPTIONS.find((item) => item.id === sort) ?? SORT_OPTIONS[0];

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  if (category && !known) {
    return (
      <div className="page">
        <div className="empty">
          <EmptyArt kind="search" />
          <strong>没有这个分类</strong>
          <p>换个分类再逛，或回全部菜单。</p>
          <div className="empty-actions">
            <Link className="btn-primary" to="/browse">
              回全部菜单
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const visibleIds = ordered.slice(0, limit).map((d) => d.id);
  const toggleSelect = (id: string, shiftKey: boolean) => {
    setSelected((prev) => {
      const order = visibleIds;
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
    const go = skipped > 0 ? { actionLabel: "去看看", undo: () => navigate("/tonight") } : {};
    if (added === 0) {
      toast(skipped > 0 ? "勾选的都已在今晚" : "没有可加入的菜", { ms: 5200, ...go });
    } else {
      const bits = [`已把 ${added} 道加入今晚`];
      if (skipped) bits.push(`跳过 ${skipped} 道已在菜单`);
      toast(bits.join(" · "), { ms: 5200, ...go });
    }
    setSelected([]);
    setSelectMode(false);
    hapticTap();
  };


  return (
    <div className="page">
      <header className="subhead">
        <button type="button" className="icon-btn" onClick={back} aria-label="返回">
          <BackIcon />
        </button>
        <div>
          <h1>{title}</h1>
          <p>{ordered.length} 道</p>
        </div>
        <ThemeButton />
      </header>

      <label className="search">
        <SearchIcon />
        <input
          value={query}
          placeholder={category ? "搜菜名" : "搜菜名或分类"}
          aria-label="搜索"
          enterKeyHint="search"
          onChange={(event) => {
            const next = event.target.value;
            setLimit(PAGE_SIZE);
            if (next) setSearchParams({ q: next }, { replace: true });
            else setSearchParams({}, { replace: true });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const q = query.trim();
              if (q) setSearchHist(pushSearchHistory(q));
            }
          }}
          onBlur={() => {
            const q = query.trim();
            if (q) setSearchHist(pushSearchHistory(q));
          }}
        />
        {query.length > 0 ? (
          <button
            type="button"
            className="clear-btn is-visible"
            onClick={() => {
              setLimit(PAGE_SIZE);
              setSearchParams({}, { replace: true });
            }}
            aria-label="清除搜索"
          >
            ×
          </button>
        ) : null}
      </label>

      {!query.trim() && searchHist.length > 0 && (
        <div className="search-history" aria-label="最近搜索">
          <p className="search-hist-label">最近搜过</p>
          <div className="chips-fade search-hist-fade">
            <div className="chips search-hist-chips">
              {searchHist.map((item) => (
                <span key={item} className="search-hist-item">
                  <button
                    type="button"
                    className="chip search-hist-chip"
                    onClick={() => {
                      setLimit(PAGE_SIZE);
                      setSearchParams({ q: item }, { replace: true });
                      setSearchHist(pushSearchHistory(item));
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
              setLimit(PAGE_SIZE);
              setSearchParams({}, { replace: true });
              hapticTap();
            }}
          >
            清空
          </button>
        </div>
      )}

      <ChipsFade className="browse-chips-sticky" data-chips="browse">
        <div className="chips" role="tablist" aria-label="分类">
          <Link
            className={!category ? "chip chip-cat on" : "chip chip-cat"}
            to="/browse"
            aria-selected={!category}
            role="tab"
          >
            <span className="chip-cat-icon chip-cat-all" aria-hidden="true" />
            <span className="chip-cat-label">全部</span>
          </Link>
          {categories.map((item) => (
            <Link
              key={item.id}
              className={category === item.id ? "chip chip-cat on" : "chip chip-cat"}
              to={`/c/${encodeURIComponent(item.id)}`}
              aria-selected={category === item.id}
              role="tab"
            >
              <span className="chip-cat-icon" aria-hidden="true">
                <CatPaint motif={item.motif} label={item.short} />
              </span>
              <span className="chip-cat-label">{item.short}</span>
            </Link>
          ))}
        </div>
      </ChipsFade>

      <div className="toolbar browse-filter-sticky" role="group" aria-label="筛选与排序">
        <p className="hint">{sortMeta.hint}</p>
        <div className="browse-filter-row">
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
        </div>
        <div className="segmented sort-segmented" role="tablist" aria-label="排序">
          {SORT_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={sort === item.id}
              className={sort === item.id ? "seg on" : "seg"}
              onClick={() => setSort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {listPending ? (
        <DishGridSkeleton count={8} className="is-browse-grid" label="加载菜单" />
      ) : ordered.length === 0 ? (
        <div className={query.trim() || refinedOnly ? "empty search-empty" : "empty"}>
          <EmptyArt kind="search" />
          <strong>
            {query.trim()
              ? category
                ? `「${category}」里没找到「${query.trim()}」`
                : `没搜到「${query.trim()}」`
              : refinedOnly
                ? category
                  ? `「${category}」里暂时没有精修菜`
                  : "这边没有精修菜"
                : "这一类还是空的"}
          </strong>
          <p>
            {query.trim() || refinedOnly
              ? "清掉筛选就能看到列表；分类会留着。"
              : "回全部菜单再逛逛，或用上面的搜索找菜。"}
          </p>
          {query.trim() || refinedOnly ? (
            <div className="empty-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setLimit(PAGE_SIZE);
                  if (refinedOnly) {
                    setRefinedOnly(false);
                    saveRefinedOnly(false);
                  }
                  if (query.trim()) {
                    const next = new URLSearchParams(searchParams);
                    next.delete("q");
                    setSearchParams(next, { replace: true });
                  }
                  hapticTap();
                }}
              >
                清除筛选
              </button>
              <Link className="btn-ghost" to="/browse">
                去翻菜单
              </Link>
            </div>
          ) : (
            <div className="empty-actions">
              <Link className="btn-primary" to="/browse">
                回全部菜单
              </Link>
              <button type="button" className="btn-ghost" onClick={() => { if (!oncePrimary("roll")) return; rollTonight(); }} disabled={rolling || rollCooling}>
                随机开饭
              </button>
            </div>
          )}
        </div>
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
          <div className="dish-grid is-browse-grid is-cards-ready" data-refresh={refreshNonce}>
            {ordered.slice(0, limit).map((dish, index) => (
              <DishCard
                key={dish.id}
                dish={dish}
                highlight={query.trim() || undefined}
                priority={index < priorityCount}
                selectMode={selectMode && isDesk}
                selected={selected.includes(dish.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
          {limit < ordered.length ? (
            <button
              type="button"
              className="btn-ghost more-btn"
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
            >
              加载更多（还有 {ordered.length - limit} 道）
            </button>
          ) : (
            <p className="list-end hint" role="status">
              {ordered.length <= PAGE_SIZE
                ? `以上共 ${ordered.length} 道`
                : `已显示全部 ${ordered.length} 道`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
