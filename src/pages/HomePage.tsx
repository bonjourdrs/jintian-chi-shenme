import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CatPaint, Die } from "../components/Art.tsx";
import { DinnerSummary } from "../components/DinnerSummary.tsx";
import { DishCard } from "../components/DishCard.tsx";
import { SearchIcon } from "../components/Icons.tsx";
import { ThemeButton } from "../components/ThemeSheet.tsx";
import {
  categories,
  dishById,
  dishes,
  featuredDishes,
  searchDishes,
} from "../data/catalog.ts";
import { recipeFor } from "../data/recipes.ts";
import { loadRecent } from "../lib/recent.ts";
import { loadSearchHistory, pushSearchHistory } from "../lib/searchHistory.ts";
import { mealSummary } from "../lib/meal.ts";
import { useTitle } from "../lib/useTitle.ts";
import { useApp } from "../state/store.tsx";

export function HomePage() {
  useTitle();
  const { state, openMeal, rollTonight, rolling, rollCooling } = useApp();
  const [params, setParams] = useSearchParams();
  const query =
    params.get("q") ?? sessionStorage.getItem("jte.home.query") ?? "";
  const setQuery = (value: string) => {
    sessionStorage.setItem("jte.home.query", value);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  };
  const [history, setHistory] = useState(() => loadSearchHistory());
  const refined =
    params.get("refined") === "1" ||
    (!params.has("refined") &&
      sessionStorage.getItem("jte.home.refined") === "1");
  const setRefined = (value: boolean) => {
    sessionStorage.setItem("jte.home.refined", value ? "1" : "0");
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("refined", value ? "1" : "0");
        return next;
      },
      { replace: true },
    );
  };
  const recent = useMemo(
    () =>
      loadRecent()
        .map((entry) => dishById.get(entry.id))
        .filter((dish) => Boolean(dish))
        .slice(0, 4),
    [],
  );
  const recommended = useMemo(
    () =>
      [
        ...new Map(
          [...featuredDishes(), ...dishes.slice(0, 8)].map((dish) => [
            dish.id,
            dish,
          ]),
        ).values(),
      ].slice(0, 8),
    [],
  );
  const needle = query.trim();
  const results = needle ? searchDishes(needle) : recommended;
  const visible = refined
    ? results.filter((dish) => recipeFor(dish).fromOverride)
    : results;
  const remember = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      pushSearchHistory(trimmed);
      setHistory(loadSearchHistory());
    }
  };
  return (
    <div className="page home home-v106">
      <header className="home-top">
        <Link className="home-wordmark" to="/">
          今天吃什么<span>两个人的晚餐 · 简单又幸福</span>
        </Link>
        <div className="home-actions">
          <Link className="see-all" to="/us">
            想吃收藏
          </Link>
          <ThemeButton />
        </div>
      </header>
      <div className="home-layout">
        <section className="dinner-hero" aria-labelledby="dinner-heading">
          <p className="eyebrow">好好吃饭，就是生活的小确幸</p>
          <h1 id="dinner-heading">今晚吃什么？</h1>
          <p>一桌家常，两个人慢慢吃。</p>
          <button
            type="button"
            className="btn-primary hero-roll"
            onClick={rollTonight}
            disabled={rolling || rollCooling}
          >
            <Die pips={5} />
            <span>
              {rolling ? "正在为你搭配…" : "摇一桌"}
              <small>让今晚多一点惊喜</small>
            </span>
          </button>
          <button
            type="button"
            className="hero-meal linkish"
            onClick={openMeal}
          >
            {mealSummary(state.meal)} · 调整搭配
          </button>
        </section>
        <DinnerSummary />
        <div className="home-main">
          <form
            className="home-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              remember(query);
            }}
          >
            <label className="search">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="搜索菜名"
                placeholder="搜菜名、食材或分类"
                enterKeyHint="search"
              />
              {query ? (
                <button
                  type="button"
                  className="clear-btn is-visible"
                  onClick={() => setQuery("")}
                  aria-label="清除搜索"
                >
                  ×
                </button>
              ) : null}
            </label>
          </form>
          {!needle && history.length ? (
            <div className="home-history">
              <span>最近搜过</span>
              {history.slice(0, 4).map((text) => (
                <button
                  key={text}
                  className="chip"
                  onClick={() => setQuery(text)}
                >
                  {text}
                </button>
              ))}
            </div>
          ) : null}
          <nav className="cat-grid" aria-label="菜品分类">
            {categories.map((category) => (
              <Link
                key={category.id}
                className="cat-tile"
                to={`/c/${encodeURIComponent(category.id)}`}
              >
                <CatPaint motif={category.motif} />
                <span>{category.short}</span>
              </Link>
            ))}
          </nav>
          <section className="home-featured-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">
                  {needle ? `找到 ${visible.length} 道菜` : "每天都有好滋味"}
                </p>
                <h2>{needle ? `“${needle}”的搜索结果` : "今天想做的家常菜"}</h2>
              </div>
              <Link className="see-all" to="/browse">
                全部 {dishes.length} 道 →
              </Link>
            </div>
            <label className="refined-filter">
              <input
                type="checkbox"
                checked={refined}
                onChange={(event) => setRefined(event.target.checked)}
              />
              只看完整菜谱
            </label>
            {visible.length ? (
              <div className="dish-grid is-home-grid">
                {visible.map((dish, index) => (
                  <DishCard key={dish.id} dish={dish} priority={index < 4} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <strong>还没找到这道菜</strong>
                <p>换个名字试试，或把它写进自己的账本。</p>
                <Link to="/ledger/new" className="btn-secondary">
                  写一道自己的菜
                </Link>
              </div>
            )}
          </section>
          {!needle && recent.length ? (
            <section className="home-recent">
              <div className="section-head">
                <h2>最近看过</h2>
              </div>
              <div className="dish-grid">
                {recent.map(
                  (dish) => dish && <DishCard key={dish.id} dish={dish} />,
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
