import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DishArt, EmptyArt, FadeCover } from "../components/Art.tsx";
import { dishById, dishes } from "../data/catalog.ts";
import { copyText } from "../lib/hema.ts";
import { groupByWeek, startOfWeek } from "../lib/ledgerWeeks.ts";
import { useTitle } from "../lib/useTitle.ts";
import { useApp } from "../state/store.tsx";
import type { LedgerEntry } from "../types.ts";

const dishByName = new Map(dishes.map((dish) => [dish.name.trim(), dish]));

function resolveDish(name: string) {
  const key = name.trim();
  if (!key) return undefined;
  return dishById.get(key) ?? dishByName.get(key);
}

function formatLedgerDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ts));
  } catch {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }
}

function matchesFilter(entry: LedgerEntry, needle: string): boolean {
  if (!needle) return true;
  const name = (entry.name || "").toLowerCase();
  const notes = (entry.notes || "").toLowerCase();
  const ingredients = (entry.ingredients || "").toLowerCase();
  return name.includes(needle) || notes.includes(needle) || ingredients.includes(needle);
}

type JumpKind = "this" | "last" | "older";

export function LedgerPage() {
  useTitle("我们的账本");
  const { state, toast } = useApp();
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const entries = useMemo(
    () => [...state.ledger].sort((a, b) => b.updatedAt - a.updatedAt),
    [state.ledger],
  );
  const filtered = useMemo(
    () => (needle ? entries.filter((entry) => matchesFilter(entry, needle)) : entries),
    [entries, needle],
  );
  const groups = useMemo(() => groupByWeek(filtered), [filtered]);
  const thisWeekStart = startOfWeek(Date.now());
  const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
  const thisGroup = groups.find((g) => g.weekStart === thisWeekStart);
  const lastGroup = groups.find((g) => g.weekStart === lastWeekStart);
  const olderGroups = groups.filter(
    (g) => g.weekStart !== thisWeekStart && g.weekStart !== lastWeekStart,
  );
  /** Unfiltered this-week stats (ignore search needle). */
  const weekStats = useMemo(() => {
    const weekEntries = entries.filter((e) => startOfWeek(e.updatedAt) === thisWeekStart);
    const meals = weekEntries.length;
    const dishes = new Set(
      weekEntries.map((e) => (e.name || "").trim()).filter(Boolean),
    ).size;
    return { meals, dishes };
  }, [entries, thisWeekStart]);
  const [activeJump, setActiveJump] = useState<JumpKind>("this");
  const scrollerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollerRef.current = document.querySelector(".app-scroll");
  }, []);

  useEffect(() => {
    if (filtered.length === 0) return;
    const root = scrollerRef.current;
    const nodes = ["ledger-week-this", "ledger-week-last", "ledger-week-older"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (nodes.length === 0) return;
    const obs = new IntersectionObserver(
      (items) => {
        const visible = items
          .filter((item) => item.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target?.id) return;
        if (visible.target.id === "ledger-week-this") setActiveJump("this");
        else if (visible.target.id === "ledger-week-last") setActiveJump("last");
        else setActiveJump("older");
      },
      { root: root ?? null, rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] },
    );
    for (const node of nodes) obs.observe(node);
    return () => obs.disconnect();
  }, [filtered.length, groups.length]);

  const jumpTo = (kind: JumpKind) => {
    setActiveJump(kind);
    const id =
      kind === "this" ? "ledger-week-this" : kind === "last" ? "ledger-week-last" : "ledger-week-older";
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportLedger = async () => {
    if (entries.length === 0) {
      toast("账本还是空的，先写一道再导出");
      return;
    }
    const lines: string[] = ["我们的账本"];
    let exported = 0;
    const cap = 40;
    const allGroups = groupByWeek(entries);
    for (const group of allGroups) {
      if (exported >= cap) break;
      lines.push("", `【${group.label}】`);
      for (const entry of group.entries) {
        if (exported >= cap) break;
        const date = formatLedgerDate(entry.updatedAt);
        const name = entry.name.trim() || "未命名的一道";
        lines.push(`${date}  ${name}`);
        exported += 1;
      }
    }
    if (entries.length > cap) {
      lines.push(`…共 ${entries.length} 条，已导出最近 ${cap} 条`);
    }
    const ok = await copyText(lines.join("\n"));
    toast(ok ? "账本已复制（按周）" : "没能复制，请手动选择");
  };

  const renderEntries = (list: typeof entries) => (
    <ul className="ledger-list">
      {list.map((entry) => {
        const name = entry.name.trim();
        const known = resolveDish(name);
        const category = known?.category ?? "家常热菜";
        const showOwnPhoto = Boolean(entry.image);
        return (
          <li key={entry.id}>
            <Link className="ledger-card" to={`/ledger/${entry.id}`}>
              {showOwnPhoto && entry.image ? (
                <span className="mini-art ledger-cover">
                  <FadeCover src={entry.image} />
                </span>
              ) : name ? (
                <span className="mini-art ledger-cover">
                  <DishArt name={known?.name ?? name} category={category} />
                </span>
              ) : (
                <span className="mini-art ledger-art-fallback" aria-hidden="true">
                  🍽
                </span>
              )}
              <span className="ledger-card-body">
                <h3 title={name || "未命名的一道"}>{name || "未命名的一道"}</h3>
                <p>{entry.notes.trim() || "还没写笔记"}</p>
                <small className="ledger-date">{formatLedgerDate(entry.updatedAt)}</small>
              </span>
              <span className="ledger-card-edit" aria-hidden="true">
                编辑
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const emptyWeek = (label: string, hint: string) => (
    <div className="ledger-week-empty" role="status">
      <strong>{label}还没有记录</strong>
      <p>{hint}</p>
    </div>
  );

  return (
    <div className="page ledger-page">
      <header className="page-intro split">
        <div>
          <p className="eyebrow">只属于你们</p>
          <h1 className="page-title">
            我们的账本
            {entries.length > 0 ? (
              <em className="count-chip" aria-label={`账本 ${entries.length} 道`}>
                {entries.length} 道
              </em>
            ) : null}
          </h1>
          <p className="hint">做过的菜、翻过的车、只属于两个人的口味，都写在这。</p>
          <p className="ledger-week-stats" role="status">
            {weekStats.meals === 0
              ? "本周还没记下菜"
              : `本周 ${weekStats.meals} 顿 · ${weekStats.dishes} 道菜`}
          </p>
        </div>
        <div className="ledger-actions">
          {entries.length > 0 && (
            <button type="button" className="btn-ghost" onClick={() => void exportLedger()}>
              导出账本
            </button>
          )}
          <Link className="btn-primary ledger-add-btn" to="/ledger/new">
            写一道
          </Link>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="empty ledger-empty">
          <EmptyArt kind="ledger" />
          <strong>账本还是空白的</strong>
          <p>第一页可以很短：菜名、几样食材、一句笔记。</p>
          <p className="hint">小提示：从菜详情点「记进账本」，封面会自动带上；也能手写只属于你们的一道。</p>
          <div className="empty-actions">
            <Link className="btn-primary" to="/ledger/new">
              写下第一道
            </Link>
            <Link className="btn-secondary" to="/browse">
              先逛菜单
            </Link>
          </div>
        </div>
      ) : (
        <>
          <label className="search ledger-filter">
            <span className="sr-only">按菜名筛选账本</span>
            <input
              type="search"
              value={filter}
              placeholder="搜菜名 / 笔记 / 食材"
              enterKeyHint="search"
              autoComplete="off"
              onChange={(event) => setFilter(event.target.value)}
            />
            {filter.trim() ? (
              <button
                type="button"
                className="clear-btn"
                aria-label="清空筛选"
                onClick={() => setFilter("")}
              >
                清空
              </button>
            ) : null}
          </label>

          {needle && filtered.length === 0 ? (
            <div className="empty ledger-empty ledger-filter-empty">
              <EmptyArt kind="search" />
              <strong>没找到「{filter.trim()}」</strong>
              <p>换个菜名或笔记关键词试试，或清空筛选看全部。</p>
              <div className="empty-actions">
                <button type="button" className="btn-primary" onClick={() => setFilter("")}>
                  清空筛选
                </button>
                <Link className="btn-ghost" to="/ledger/new">
                  写一道
                </Link>
              </div>
            </div>
          ) : (
            <>
              <nav className="ledger-week-jump" aria-label="按周跳转">
                {(
                  [
                    ["this", "本周", thisGroup?.entries.length ?? 0],
                    ["last", "上周", lastGroup?.entries.length ?? 0],
                    ["older", "更早", olderGroups.reduce((n, g) => n + g.entries.length, 0)],
                  ] as const
                ).map(([kind, label, count]) => (
                  <button
                    key={kind}
                    type="button"
                    className={activeJump === kind ? "chip on" : "chip"}
                    aria-pressed={activeJump === kind}
                    onClick={() => jumpTo(kind)}
                  >
                    {label}
                    <em className="jump-count">{count}</em>
                  </button>
                ))}
              </nav>
              {needle ? (
                <p className="hint ledger-filter-hint" role="status">
                  筛到 <strong>{filtered.length}</strong> 道
                </p>
              ) : null}

              <div className="ledger-weeks">
                <section
                  id="ledger-week-this"
                  className="ledger-week is-this"
                  aria-label="本周"
                >
                  <h2 className="ledger-week-title is-sticky">
                    <span className="week-pill kind-this">本周</span>
                    <span className="week-range">
                      {(thisGroup?.label ?? "").replace(/^本周 · /, "") || "这一周"}
                    </span>
                    <em className="week-count">{thisGroup?.entries.length ?? 0}</em>
                  </h2>
                  {thisGroup && thisGroup.entries.length > 0
                    ? renderEntries(thisGroup.entries)
                    : emptyWeek("本周", needle ? "本周没有匹配的记录。" : "这周还没记下菜，做完一道就写进来吧。")}
                </section>

                <section id="ledger-week-last" className="ledger-week is-last" aria-label="上周">
                  <h2 className="ledger-week-title is-sticky">
                    <span className="week-pill kind-last">上周</span>
                    <span className="week-range">
                      {(lastGroup?.label ?? "").replace(/^上周 · /, "") || "上一周"}
                    </span>
                    <em className="week-count">{lastGroup?.entries.length ?? 0}</em>
                  </h2>
                  {lastGroup && lastGroup.entries.length > 0
                    ? renderEntries(lastGroup.entries)
                    : emptyWeek("上周", needle ? "上周没有匹配的记录。" : "上周空着也没关系，布局还在。")}
                </section>

                <section id="ledger-week-older" className="ledger-week is-older" aria-label="更早">
                  <h2 className="ledger-week-title is-sticky">
                    <span className="week-pill kind-older">更早</span>
                    <span className="week-range">更早的记录</span>
                    <em className="week-count">
                      {olderGroups.reduce((n, g) => n + g.entries.length, 0)}
                    </em>
                  </h2>
                  {olderGroups.length === 0
                    ? emptyWeek("更早", needle ? "更早没有匹配的记录。" : "再往前还没有条目。")
                    : olderGroups.map((group) => (
                        <div key={group.weekStart} className="ledger-older-block">
                          <p className="ledger-older-label">{group.label}</p>
                          {renderEntries(group.entries)}
                        </div>
                      ))}
                </section>

                <div className="ledger-footer-add">
                  <Link className="btn-secondary" to="/ledger/new">
                    再写一道
                  </Link>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
