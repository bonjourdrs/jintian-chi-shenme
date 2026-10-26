import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { dishById } from "../data/catalog.ts";
import { buildShopping, uncheckedCount } from "../lib/shopping.ts";
import { useApp } from "../state/store.tsx";
import { DeskOrnament, Die, NavCodexIcon } from "./Art.tsx";
import { HomeIcon, ListIcon, PeopleIcon } from "./Icons.tsx";
import { MealSheet } from "./MealSheet.tsx";
import { InstallHint } from "./InstallHint.tsx";
import { TopChips } from "./TopChips.tsx";
import { DeskKeys } from "./DeskKeys.tsx";
import { OnboardSheet } from "./OnboardSheet.tsx";
import { ThemeSheet } from "./ThemeSheet.tsx";
import {
  applySideWidth,
  clampSideWidth,
  loadSideMode,
  loadSideWidth,
  saveSideMode,
  saveSideWidth,
  type SideMode,
} from "../lib/sidebar.ts";
import { isOnline } from "../lib/online.ts";
import { APP_VERSION } from "../lib/version.ts";

const PULL_THRESHOLD = 64;

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      window.dispatchEvent(new Event("jte-shell-ready"));
    } catch {
      /* ignore */
    }
  }, []);

  const { pathname } = useLocation();
  const { state, rolling, rollHint, themeOpen, mealOpen, toasts, toast, dismissToast } = useApp();
  const scroller = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [sideMode, setSideMode] = useState<SideMode>(() => loadSideMode());
  const [sideWidth, setSideWidth] = useState(() => loadSideWidth());
  const [sideHover, setSideHover] = useState(false);
  const sideDrag = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    applySideWidth(sideWidth);
  }, [sideWidth]);
  const [tonightPop, setTonightPop] = useState(false);
  const tonightPrev = useRef<number | null>(null);
  const pull = useRef({ active: false, startY: 0, armed: false, dist: 0 });
  const scrollMemory = useRef<Map<string, number>>(new Map());
  const prevPathRef = useRef(pathname);
  const readScroll = (path: string) => {
    const hit = scrollMemory.current.get(path);
    if (typeof hit === "number") return hit;
    try {
      const raw = sessionStorage.getItem(`jte.scroll.${path}`);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) {
          scrollMemory.current.set(path, n);
          return n;
        }
      }
    } catch {
      /* ignore */
    }
    return 0;
  };
  const writeScroll = (path: string, top: number) => {
    scrollMemory.current.set(path, top);
    try {
      sessionStorage.setItem(`jte.scroll.${path}`, String(Math.round(top)));
    } catch {
      /* ignore */
    }
  };
  const modal = rolling || themeOpen || mealOpen;
  const pullable =
    pathname === "/" || pathname.startsWith("/browse") || pathname.startsWith("/c/");
  const longList =
    pathname === "/" ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/browse") ||
    pathname.startsWith("/d/");
  const cookOpen = pathname.startsWith("/d/");

  useEffect(() => {
    const onFlood = () => {
      toast("封面暂时加载不出，已改用占位图 · 点封面可重试一次", { ms: 4200 });
    };
    window.addEventListener("jte-cover-fail-flood", onFlood as EventListener);
    return () => window.removeEventListener("jte-cover-fail-flood", onFlood as EventListener);
  }, [toast]);

  useEffect(() => {
    const el = scroller.current;
    const prev = prevPathRef.current;
    if (el && prev) {
      writeScroll(prev, el.scrollTop);
    }
    prevPathRef.current = pathname;

    setPullY(0);
    setPullReady(false);
    pull.current = { active: false, startY: 0, armed: false, dist: 0 };

    const isDish = pathname.startsWith("/d/");
    const isEdit = pathname.startsWith("/ledger/") && pathname !== "/ledger";
    /* Detail / edit: start at top. List routes: restore remembered scroll. */
    if (isDish || isEdit) {
      el?.scrollTo({ top: 0 });
      setShowTop(false);
      return;
    }
    const saved = readScroll(pathname);
    const restore = () => {
      el?.scrollTo({ top: saved });
      setShowTop(saved > Math.max((el?.clientHeight ?? 0) * 1.25, 560));
    };
    restore();
    requestAnimationFrame(restore);
  }, [pathname]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !longList) {
      setShowTop(false);
      return;
    }
    const onScroll = () => {
      /* Show after ~1.25 screens; hide again near top (threshold floor). */
      const threshold = Math.max(el.clientHeight * 1.25, 560);
      setShowTop(el.scrollTop > threshold);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [longList, pathname]);

  const scrollTop = useCallback(() => {
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const runHomeRefresh = useCallback(async () => {
    /* Keep current scroll — only reset pull chrome (caller already cleared pullY). */
    window.dispatchEvent(new CustomEvent("jte-refresh"));
    if (!isOnline()) {
      toast("现在离线，先看本机菜单");
      return;
    }
    try {
      const base = import.meta.env.BASE_URL || "./";
      await Promise.allSettled([
        fetch(`${base}sw.js`, { cache: "no-store" }),
        fetch(`${base}index.html`, { cache: "no-store" }),
      ]);
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      toast("已从网络刷新");
    } catch {
      toast("刷新未完成，仍显示本机菜单");
    }
  }, [toast]);

  const onPullStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!pullable || modal) return;
      const el = scroller.current;
      if (!el || el.scrollTop > 2) {
        pull.current.active = false;
        return;
      }
      pull.current = { active: true, startY: event.touches[0]?.clientY ?? 0, armed: false, dist: 0 };
    },
    [pullable, modal],
  );

  const onPullMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!pull.current.active || !pullable) return;
      const el = scroller.current;
      if (!el || el.scrollTop > 2) {
        pull.current.active = false;
        setPullY(0);
        setPullReady(false);
        return;
      }
      const y = event.touches[0]?.clientY ?? 0;
      const dy = Math.max(0, y - pull.current.startY);
      if (dy < 8) return;
      pull.current.armed = true;
      const dist = Math.min(96, dy * 0.45);
      pull.current.dist = dist;
      setPullY(dist);
      setPullReady(dist >= PULL_THRESHOLD);
    },
    [pullable],
  );

  const onPullEnd = useCallback(() => {
    if (!pull.current.active) return;
    const should = pull.current.armed && pull.current.dist >= PULL_THRESHOLD;
    pull.current = { active: false, startY: 0, armed: false, dist: 0 };
    setPullY(0);
    setPullReady(false);
    if (should) void runHomeRefresh();
  }, [runHomeRefresh]);

  const shopping = useMemo(() => {
    const menuDishes = state.menuDishIds
      .map((id) => dishById.get(id))
      .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
    return buildShopping({
      dishes: menuDishes,
      ledger: state.ledger,
      ledgerIds: state.menuLedgerIds,
      extras: state.extras,
      bought: state.bought,
    });
  }, [state.bought, state.extras, state.ledger, state.menuDishIds, state.menuLedgerIds]);

  const badge = uncheckedCount(shopping);
  const wantBadge = state.hearts.length;
  const tonightCount = state.menuDishIds.length + state.menuLedgerIds.length;

  useEffect(() => {
    const prev = tonightPrev.current;
    tonightPrev.current = tonightCount;
    if (prev == null || prev === tonightCount) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    setTonightPop(true);
    const id = window.setTimeout(() => setTonightPop(false), 380);
    return () => window.clearTimeout(id);
  }, [tonightCount]);

  const sideCollapsed = sideMode === "collapsed" && !sideHover;
  const toggleSide = () => {
    setSideMode((cur) => {
      const next: SideMode = cur === "collapsed" ? "expanded" : "collapsed";
      saveSideMode(next);
      return next;
    });
  };

  const menuOn =
    pathname === "/" ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/d/") ||
    pathname.startsWith("/browse") ||
    pathname.startsWith("/tonight");
  const listOn = pathname.startsWith("/list");
  const usOn = pathname.startsWith("/us") || pathname.startsWith("/ledger");

  return (
    <div className="world">
      <div className="atmosphere" aria-hidden="true">
        <div className="wash wash-a" />
        <div className="wash wash-b" />
        <svg className="doodle one" viewBox="0 0 80 80">
          <path
            d="M40 70 V42 M28 50 q-12 8 -6 18 M52 50 q12 8 6 18 M40 42 q-18 -22 0 -32 q18 10 0 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <svg className="doodle two" viewBox="0 0 80 80">
          <path
            d="M40 8 v18 M30 26 h20 M34 26 c0 20 4 28 6 36 M46 26 c0 20 -4 28 -6 36 M28 70 h24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <div className="desk-caption">
          <DeskOrnament />
          <p className="desk-kicker">晚饭还没定</p>
          <strong>今天吃什么</strong>
          <p className="desk-sub">两个人的手账</p>
        </div>
      </div>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main-content");
          if (!main) return;
          main.focus({ preventScroll: true });
          try {
            main.scrollIntoView({ block: "start" });
          } catch {
            /* ignore */
          }
        }}
      >
        跳到主要内容
      </a>
      <div
        className={[
          "app-frame",
          modal ? "is-modal" : "",
          sideMode === "collapsed" ? "side-pref-collapsed" : "side-pref-expanded",
          sideCollapsed ? "is-side-collapsed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-side={sideCollapsed ? "collapsed" : "expanded"}
      >
        <div className="app-accent-bar" aria-hidden="true" />
        <TopChips />
        <DeskKeys />
        <div className="grain" />
        <div className="holes" />
        <div className="binding" />
        <div className="stain stain-a" />
        <div className="stain stain-b" />
        <div
          id="main-content"
          className={pullY > 0 ? "app-scroll is-pulling" : "app-scroll"}
          ref={scroller}
          tabIndex={-1}
          role="main"
          onTouchStart={onPullStart}
          onTouchMove={onPullMove}
          onTouchEnd={onPullEnd}
          onTouchCancel={onPullEnd}
        >
          {pullable && (
            <div
              className={pullReady ? "pull-hint is-ready" : "pull-hint"}
              style={{ height: pullY > 0 ? pullY : 0, opacity: pullY > 12 ? 1 : pullY / 12 }}
              aria-hidden={pullY <= 0}
            >
              <span>{pullReady ? "松开刷新" : "下拉刷新"}</span>
            </div>
          )}
          <div key={pathname} className="route-view">
            <InstallHint />
            {children}
          </div>
        </div>
        <nav
          className="tabbar"
          aria-label="主导航"
          onMouseEnter={() => {
            if (sideMode === "collapsed") setSideHover(true);
          }}
          onMouseLeave={() => setSideHover(false)}
        >
          <div className="side-brand" aria-hidden="true">
            <DeskOrnament />
            <p className="side-kicker">晚饭手账</p>
            <strong>今天吃什么</strong>
          </div>
          <button
            type="button"
            className="side-collapse-btn"
            aria-pressed={sideMode === "collapsed"}
            aria-label={sideMode === "collapsed" ? "展开侧栏" : "折叠侧栏"}
            title={sideMode === "collapsed" ? "展开侧栏" : "折叠侧栏，腾出内容宽度"}
            onClick={toggleSide}
          >
            <span className="side-collapse-icon" aria-hidden="true">
              {sideMode === "collapsed" ? "»" : "«"}
            </span>
            <span className="side-collapse-label">{sideMode === "collapsed" ? "展开" : "折叠"}</span>
          </button>
          <div
            className="side-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调整侧栏宽度"
            title="拖动调整侧栏宽度（双击恢复默认）"
            onPointerDown={(event) => {
              if (sideMode === "collapsed") return;
              event.preventDefault();
              (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
              sideDrag.current = { startX: event.clientX, startW: sideWidth };
            }}
            onPointerMove={(event) => {
              const drag = sideDrag.current;
              if (!drag) return;
              const next = clampSideWidth(drag.startW + (event.clientX - drag.startX));
              setSideWidth(next);
              applySideWidth(next);
            }}
            onPointerUp={(event) => {
              if (!sideDrag.current) return;
              const drag = sideDrag.current;
              sideDrag.current = null;
              try {
                (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
              } catch {
                /* ignore */
              }
              const next = clampSideWidth(drag.startW + (event.clientX - drag.startX));
              setSideWidth(next);
              applySideWidth(next);
              saveSideWidth(next);
            }}
            onPointerCancel={() => {
              sideDrag.current = null;
            }}
            onDoubleClick={() => {
              const next = 168;
              setSideWidth(next);
              applySideWidth(next);
              saveSideWidth(next);
            }}
          />
          <Link
            className={
              menuOn
                ? pathname === "/"
                  ? "tab on"
                  : "tab on is-nested"
                : "tab"
            }
            to="/"
            aria-current={menuOn ? "page" : undefined}
            data-nav="menu"
            aria-label={tonightCount > 0 ? `菜单，今晚 ${tonightCount} 道` : "菜单"}
            title={tonightCount > 0 ? `菜单 · 今晚 ${tonightCount} 道` : "菜单"}
          >
            <NavCodexIcon name="home" fallback={<HomeIcon />} />
            <span>菜单</span>
            {tonightCount > 0 ? (
              <em
                className={tonightPop ? "badge tonight-badge is-pop" : "badge tonight-badge"}
                title={`今晚 ${tonightCount} 道`}
              >
                {tonightCount > 99 ? "99+" : tonightCount}
              </em>
            ) : null}
          </Link>
          <Link
            className={listOn ? "tab on" : "tab"}
            to="/list"
            aria-current={listOn ? "page" : undefined}
            aria-label={badge > 0 ? `清单，还有 ${badge} 项未勾选` : "清单"}
            title="清单"
          >
            <NavCodexIcon name="shop" fallback={<ListIcon />} />
            <span>清单</span>
            {badge > 0 && (
              <em className="badge shop-badge" title={`还有 ${badge} 项未勾选`}>
                {badge > 99 ? "99+" : badge}
              </em>
            )}
          </Link>
          <Link
            className={usOn ? "tab on" : "tab"}
            to="/us"
            aria-current={usOn ? "page" : undefined}
            aria-label={wantBadge > 0 ? `我们，想吃 ${wantBadge} 道` : "我们"}
            title="我们"
          >
            <NavCodexIcon name="us" fallback={<PeopleIcon />} />
            <span>我们</span>
            {wantBadge > 0 && (
              <em className="badge want-badge" title={`想吃 ${wantBadge} 道`}>
                {wantBadge > 99 ? "99+" : wantBadge}
              </em>
            )}
          </Link>
        </nav>
        <ThemeSheet />
        <OnboardSheet />
        <MealSheet />
        {rolling && (
          <div className="dice-overlay is-reveal" role="status" aria-live="polite">
            <div className="reveal-card" aria-hidden="true">
              <div className="reveal-card-inner">
                <Die pips={3} className="spin-a" />
                <Die pips={5} className="spin-b" />
              </div>
            </div>
            <p className="reveal-title">揭晓今晚菜单</p>
            <p className={rollHint ? "reveal-sub is-feel" : "reveal-sub"}>
              {rollHint ?? "精修菜会多摇到一些 · 封面马上清晰"}
            </p>
          </div>
        )}
                <footer className="print-sheet-footer" aria-hidden="true">
          {`今天吃什么 · ${new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} · ${APP_VERSION}`}
        </footer>
        <div className="toasts" aria-live="polite" aria-relevant="additions text" aria-atomic="false">
          {toasts.map((item) => (
            <div
              key={item.id}
              role="status"
              className={item.undo ? "toast toast-with-action" : "toast"}
            >
              <span className="toast-msg">{item.message}</span>
              {item.undo ? (
                <button
                  type="button"
                  className="toast-undo"
                  onClick={() => {
                    const fn = item.undo;
                    dismissToast(item.id);
                    fn?.();
                  }}
                >
                  {item.actionLabel || "撤销"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {longList && (
          <div
            className={[
              "fab-cluster",
              showTop ? "is-visible" : "",
              cookOpen ? "near-dish" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden={!showTop}
          >
            <button
              type="button"
              className="back-top"
              onClick={scrollTop}
              aria-label="回到顶部"
              tabIndex={showTop ? 0 : -1}
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
