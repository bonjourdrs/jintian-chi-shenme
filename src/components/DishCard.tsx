import { memo, useRef, useState, type PointerEvent as PtrEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { categories, formatLikesCompact, likesOf, sourcesOf, videosOf } from "../data/catalog.ts";
import { recipeFor } from "../data/recipes.ts";
import type { Dish } from "../types.ts";
import { dishArt } from "../lib/assets.ts";
import { hapticTap } from "../lib/haptics.ts";
import { useApp } from "../state/store.tsx";
import { DishArt } from "./Art.tsx";
import { HeartIcon } from "./Icons.tsx";

const LONG_MS = 450;
const MOVE_PX = 10;

const catShort = new Map(categories.map((c) => [c.id, c.short]));

function highlightName(name: string, needle?: string) {
  if (!needle) return name;
  const raw = needle.trim();
  if (!raw) return name;

  const lowerName = name.toLowerCase();
  /* Prefer whole-query hits (all occurrences); else mark chars that appear in query. */
  const tokens = raw.split(/\s+/).filter(Boolean);
  const ranges: Array<[number, number]> = [];
  const markToken = (token: string) => {
    const q = token.toLowerCase();
    if (!q) return;
    let from = 0;
    while (from < lowerName.length) {
      const idx = lowerName.indexOf(q, from);
      if (idx < 0) break;
      ranges.push([idx, idx + q.length]);
      from = idx + Math.max(q.length, 1);
    }
  };
  for (const token of tokens) markToken(token);
  if (ranges.length === 0) {
    /* Char-level: highlight each distinct query char once per occurrence in order */
    for (const ch of [...raw]) {
      if (ch.trim()) markToken(ch);
    }
  }
  if (ranges.length === 0) return name;

  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (!last || start > last[1]) merged.push([start, end]);
    else last[1] = Math.max(last[1], end);
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (cursor < start) nodes.push(name.slice(cursor, start));
    nodes.push(
      <mark key={`hit-${start}-${end}-${i}`} className="name-hit">
        {name.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < name.length) nodes.push(name.slice(cursor));
  return <>{nodes}</>;
}

function DishCardInner({
  dish,
  highlight,
  onOpen,
  priority = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  dish: Dish;
  highlight?: string;
  onOpen?: () => void;
  /** Eager-load cover for above-the-fold / LCP */
  priority?: boolean;
  /** Desktop multi-select for tonight */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
}) {
  const { state, toggleHeart, removeHeart, insertHeartAt, toast } = useApp();
  const navigate = useNavigate();
  const recipe = recipeFor(dish);
  const liked = state.hearts.includes(dish.id);
  const hasVideo = videosOf(dish).length > 0;
  const likes = likesOf(dish);
  const likesCompact = formatLikesCompact(likes.n, likes.label);
  const likesText = likesCompact ? `${likesCompact}赞` : "";
  const short = catShort.get(dish.category) ?? dish.category.slice(0, 2);
  const hasCover = Boolean(dishArt(dish.name));
  const credit = hasCover ? sourcesOf(dish)[0] || "视频封面" : null;
  const hoverBits = [
    recipe.fromOverride ? "精修" : null,
    dish.category,
    likesText || null,
    `${recipe.minutes} 分钟`,
  ].filter(Boolean);
  const hoverTip = [dish.name, ...hoverBits].join(" · ");
  const longTimer = useRef<number | null>(null);
  const startXY = useRef<{ x: number; y: number } | null>(null);
  const longFired = useRef(false);
  const [pressed, setPressed] = useState(false);

  const clearLong = () => {
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const fireWant = () => {
    longFired.current = true;
    if (liked) {
      const snap = removeHeart(dish.id);
      hapticTap();
      if (!snap) return;
      toast(`已取消想吃「${dish.name}」`, {
        ms: 7000,
        undo: () => {
          const ok = insertHeartAt(dish.id, snap.index, snap.undoToken);
          toast(ok ? `已恢复想吃「${dish.name}」` : "撤销已失效");
        },
      });
    } else {
      toggleHeart(dish.id);
      hapticTap();
      toast(`想吃「${dish.name}」`);
    }
  };

  const onPointerDown = (event: PtrEvent) => {
    if (selectMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longFired.current = false;
    setPressed(true);
    startXY.current = { x: event.clientX, y: event.clientY };
    clearLong();
    longTimer.current = window.setTimeout(() => {
      longTimer.current = null;
      fireWant();
    }, LONG_MS);
  };

  const onPointerMove = (event: PtrEvent) => {
    if (!startXY.current) return;
    const dx = event.clientX - startXY.current.x;
    const dy = event.clientY - startXY.current.y;
    if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) {
      clearLong();
      /* Scroll / drag — drop press chrome so it doesn't look stuck */
      setPressed(false);
    }
  };

  const endPointer = () => {
    clearLong();
    setPressed(false);
  };

  return (
    <article
      className={[
        "dish-card",
        pressed ? "is-pressed" : "",
        selectMode ? "is-select-mode" : "",
        selected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={hoverTip}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onContextMenu={(event) => event.preventDefault()}
    >
      {selectMode ? (
        <label className="dish-select-check" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            aria-label={`选择 ${dish.name}`}
            onChange={(event) => {
              onToggleSelect?.(dish.id, (event.nativeEvent as MouseEvent).shiftKey);
            }}
            onClick={(event) => {
              if (event.shiftKey) {
                event.preventDefault();
                onToggleSelect?.(dish.id, true);
              }
            }}
          />
        </label>
      ) : null}
      <button
        type="button"
        className={liked ? "heart on" : "heart"}
        aria-pressed={liked}
        aria-label={liked ? `取消想吃 ${dish.name}` : `想吃 ${dish.name}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          if (liked) {
            const snap = removeHeart(dish.id);
            hapticTap();
            if (!snap) return;
            toast(`已取消想吃「${dish.name}」`, {
              ms: 7000,
              undo: () => {
                const ok = insertHeartAt(dish.id, snap.index, snap.undoToken);
                toast(ok ? `已恢复想吃「${dish.name}」` : "撤销已失效");
              },
            });
          } else {
            toggleHeart(dish.id);
            hapticTap();
            toast(`想吃「${dish.name}」`);
          }
        }}
      >
        <HeartIcon filled={liked} />
      </button>
      <Link
        className="dish-link"
        to={`/d/${encodeURIComponent(dish.id)}`}
        onClick={(event) => {
          if (selectMode) {
            event.preventDefault();
            onToggleSelect?.(dish.id, event.shiftKey);
            return;
          }
          if (longFired.current) {
            event.preventDefault();
            longFired.current = false;
            return;
          }
          onOpen?.();
        }}
      >
        <div
          className={[
            "art-frame",
            credit ? "has-credit" : "",
            hasVideo ? "has-video" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <DishArt name={dish.name} category={dish.category} priority={priority} lazy={!priority} />
          {hasVideo ? <span className="cover-dim" aria-hidden="true" /> : null}
          {recipe.fromOverride && (
            <span className="refine-badge" title="精修菜谱">
              精
            </span>
          )}
          {hasVideo ? (
            <button
              type="button"
              className="play-badge is-button"
              title="查看视频教程"
              aria-label={`查看「${dish.name}」的视频教程`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (selectMode) {
                  onToggleSelect?.(dish.id, event.shiftKey);
                  return;
                }
                hapticTap();
                navigate(`/d/${encodeURIComponent(dish.id)}#dish-anchor-video`);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 7l8 5-8 5z" />
              </svg>
            </button>
          ) : null}
          {credit ? (
            <span className="cover-credit" title={credit}>
              {credit}
            </span>
          ) : null}
        </div>
        <div className="card-body">
          <h3 title={dish.name}>{highlightName(dish.name, highlight)}</h3>
          <p className="card-meta">
            {recipe.fromOverride && (
              <span className="meta-refine" title="精修菜谱">
                精
              </span>
            )}
            <span className="meta-cat" title={dish.category}>
              {short}
            </span>
            <span className="meta-rest">
              {likesText ? (
                <>
                  <span className="meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="meta-likes">{likesText}</span>
                </>
              ) : null}
              <span className="meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="meta-mins">{recipe.minutes} 分钟</span>
            </span>
          </p>
        </div>
        <span className="card-hover-tip" aria-hidden="true">
          {hoverTip}
        </span>
      </Link>
    </article>
  );
}

export const DishCard = memo(DishCardInner);
