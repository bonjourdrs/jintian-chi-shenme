import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { NotFound } from "./NotFound.tsx";
import { DishArt } from "../components/Art.tsx";
import { DishCard } from "../components/DishCard.tsx";
import { BackIcon, HeartIcon } from "../components/Icons.tsx";
import { RichText } from "../components/RichText.tsx";
import { ThemeButton } from "../components/ThemeSheet.tsx";
import { creatorOfVideo, dishById, dishesIn, formatLikesCompact, likesOf, sourcesOf, topVideosOf } from "../data/catalog.ts";
import { ingredientNote, recipeFor } from "../data/recipes.ts";
import {
  baseServings,
  clampServings,
  MAX_SERVINGS,
  MIN_SERVINGS,
  scaleAmountText,
  scaleIngredientNote,
  scaleIngredientsForCopy,
  loadServingsForDish,
  saveServingsForDish,
} from "../lib/servings.ts";
import { dishArt } from "../lib/assets.ts";
import { hapticAlarm, hapticTap } from "../lib/haptics.ts";
import { playTimerChime } from "../lib/timerChime.ts";
import { canSpeak, loadCookSpeak, speakCookStep, stopCookSpeak } from "../lib/cookSpeak.ts";
import { copyText, hemaSearchTerm, openHema } from "../lib/hema.ts";
import { buildDishShareText, shareOrCopy } from "../lib/share.ts";
import { requireOnline } from "../lib/online.ts";
import { loadIngChecks, toggleIngCheck } from "../lib/ingChecks.ts";
import { clearStepChecks, firstIncompleteStep, loadStepChecks, toggleStepCheck } from "../lib/stepChecks.ts";
import { pushRecent } from "../lib/recent.ts";
import { useTitle } from "../lib/useTitle.ts";
import { requestCookWakeLock, type WakeLockHandle } from "../lib/wakeLock.ts";
import { isWakeLockSupported, loadCookWake, saveCookWake } from "../lib/cookWake.ts";
import { sampleCoverAmbience } from "../lib/coverAmbience.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import { useApp } from "../state/store.tsx";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function DishPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = params.id ? safeDecode(params.id) : "";
  const dish = dishById.get(id);
  const { state, toggleHeart, removeHeart, insertHeartAt, addDishToMenu, removeDishFromMenu, insertDishAtMenu, toast, saveLedger } = useApp();
  useTitle(dish?.name);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const lightboxPinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const [checkedNames, setCheckedNames] = useState<string[]>([]);
  const [heartFlash, setHeartFlash] = useState<"add" | "remove" | null>(null);
  const [cookMode, setCookMode] = useState(false);
  const cookSentinelRef = useRef(false);
  const [activeAnchor, setActiveAnchor] = useState<"video" | "ings" | "steps">("ings");
  const [cookWakePref, setCookWakePref] = useState(() => loadCookWake());
  const [heroAmbience, setHeroAmbience] = useState<string | null>(null);
  const [cookStep, setCookStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [cookJustDone, setCookJustDone] = useState(false);
  /** Cooking step timer: only one at a time. endsAt = epoch ms. */
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerSecsLeft, setTimerSecsLeft] = useState(0);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerCustom, setTimerCustom] = useState("3");
  /** Minutes chosen for current/last start — shown on dock. */
  const [timerPresetMin, setTimerPresetMin] = useState<number | null>(null);
  const [timerStepLabel, setTimerStepLabel] = useState<string>("");
  const [timerPausedLeft, setTimerPausedLeft] = useState<number | null>(null);
  const [timerInitialSecs, setTimerInitialSecs] = useState(0);
  const [timerStepIndex, setTimerStepIndex] = useState<number | null>(null);
  const [timerDonePulse, setTimerDonePulse] = useState(false);
  const [servings, setServings] = useState(baseServings());
  const [servingsPulse, setServingsPulse] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [videoOpened, setVideoOpened] = useState(false);
  const lastTapRef = useRef(0);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const timerDoneRef = useRef<number | null>(null);
  const wakeHintShown = useRef(false);
  const doneStepsRef = useRef<number[]>([]);
  const coverSrc = dish ? dishArt(dish.name) : null;
  doneStepsRef.current = doneSteps;

  useEffect(() => {
    if (dish) pushRecent(dish.id, dish.name);
    stopCookSpeak();
    let resumeCook = false;
    try {
      resumeCook = sessionStorage.getItem("jte.resume-cook") === "1";
      if (resumeCook) sessionStorage.removeItem("jte.resume-cook");
    } catch {
      resumeCook = false;
    }
    setCookMode(resumeCook);
    setCookStep(0);
    setDoneSteps(dish ? loadStepChecks(dish.id) : []);
    setTimerEndsAt(null);
    setTimerSecsLeft(0);
    setTimerOpen(false);
    setTimerStepLabel("");
    setTimerPausedLeft(null);
    setTimerInitialSecs(0);
    setTimerStepIndex(null);
    setTimerDonePulse(false);
    timerDoneRef.current = null;
    setServings(dish ? loadServingsForDish(dish.id) : baseServings());
    setParallaxY(0);
    setMoreOpen(false);
    setVideoOpened(false);
  }, [dish]);

  useEffect(() => {
    if (!dish) return;
    if (location.hash !== "#dish-anchor-video") return;
    const id = window.setTimeout(() => {
      document.getElementById("dish-anchor-video")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [dish, location.hash]);


  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current != null) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  /* Hero parallax: mobile subtle ≤10px; off on reduce-motion & desktop ≥880 sticky */
  useEffect(() => {
    if (!dish || !coverSrc) {
      setParallaxY(0);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 880px)");
    const scroller = document.querySelector(".app-scroll") as HTMLElement | null;
    if (!scroller) return;

    const apply = () => {
      if (reduce.matches || wide.matches) {
        setParallaxY(0);
        return;
      }
      const y = Math.min(10, Math.max(0, scroller.scrollTop * 0.05));
      setParallaxY(y);
    };
    apply();
    scroller.addEventListener("scroll", apply, { passive: true });
    reduce.addEventListener?.("change", apply);
    wide.addEventListener?.("change", apply);
    return () => {
      scroller.removeEventListener("scroll", apply);
      reduce.removeEventListener?.("change", apply);
      wide.removeEventListener?.("change", apply);
    };
  }, [dish, coverSrc]);


  useEffect(() => {
    if (!dish) {
      setCheckedNames([]);
      return;
    }
    setCheckedNames(loadIngChecks(dish.id));
  }, [dish]);

  /* Cooking progress: on enter, land on first incomplete; scroll to current step */
  useEffect(() => {
    if (!cookMode || !dish) return;
    const total = recipeFor(dish).steps.length;
    if (total > 0) {
      setCookStep((cur) => {
        const target = firstIncompleteStep(doneStepsRef.current, total);
        return cur === target ? cur : target;
      });
    }
  }, [cookMode, dish]);

  useEffect(() => {
    if (!cookMode) return;
    const el = stepRefs.current[cookStep];
    if (!el) return;
    const id = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
    return () => window.clearTimeout(id);
  }, [cookMode, cookStep]);

  /* Screen Wake Lock while cooking — only when「屏幕常亮」pref on; release on leave */
  useEffect(() => {
    let cancelled = false;

    const release = async () => {
      const handle = wakeLockRef.current;
      wakeLockRef.current = null;
      if (handle) await handle.release();
    };

    const acquire = async () => {
      await release();
      if (cancelled || !cookMode || !cookWakePref) return;
      const handle = await requestCookWakeLock();
      if (cancelled || !cookMode || !cookWakePref) {
        await handle?.release();
        return;
      }
      wakeLockRef.current = handle;
      if (!handle && !wakeHintShown.current) {
        wakeHintShown.current = true;
        toast("这台设备不支持屏幕常亮");
      }
    };

    if (cookMode && cookWakePref) void acquire();
    else void release();

    const onVis = () => {
      if (document.visibilityState === "visible" && cookMode && cookWakePref) void acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void release();
    };
  }, [cookMode, cookWakePref, toast]);

  useEffect(() => {
    let cancelled = false;
    setHeroAmbience(null);
    if (!coverSrc) return;
    void sampleCoverAmbience(coverSrc).then((color) => {
      if (!cancelled) setHeroAmbience(color);
    });
    return () => {
      cancelled = true;
    };
  }, [coverSrc]);


  /* Step timer: Date.now deadline (accurate when tab backgrounded); optional Notification if already granted */
  useEffect(() => {
    if (timerEndsAt == null) {
      if (timerPausedLeft != null) setTimerSecsLeft(timerPausedLeft);
      return;
    }
    const endsAt = timerEndsAt;
    const doneKey = endsAt;
    const announceDone = () => {
      if (timerDoneRef.current === doneKey) return;
      timerDoneRef.current = doneKey;
      setTimerEndsAt(null);
      setTimerPausedLeft(null);
      setTimerInitialSecs(0);
      setTimerSecsLeft(0);
      hapticAlarm();
      playTimerChime();
      setTimerDonePulse(true);
      window.setTimeout(() => setTimerDonePulse(false), 2400);
      const msg = timerStepLabel ? `计时到：${timerStepLabel}` : "计时到了";
      toast(msg, { ms: 5200 });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("今天吃什么 · 计时到了", {
            body: msg,
            tag: "jte-cook-timer",
            silent: false,
          });
          window.setTimeout(() => n.close(), 8000);
        }
      } catch {
        /* Notification blocked / unsupported — toast already shown */
      }
    };
    const sync = () => {
      const leftMs = endsAt - Date.now();
      const left = Math.max(0, Math.ceil(leftMs / 1000));
      setTimerSecsLeft(left);
      if (leftMs <= 0) announceDone();
      return leftMs;
    };
    sync();
    /* Foreground UI tick; background relies on timeout + visibility resync */
    const intervalId = window.setInterval(sync, 250);
    const leftMs0 = endsAt - Date.now();
    const timeoutId =
      leftMs0 <= 0
        ? 0
        : window.setTimeout(announceDone, Math.max(0, leftMs0) + 16);
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [timerEndsAt, timerPausedLeft, timerStepLabel, toast]);

  const timerDisplaySecs =
    timerEndsAt != null ? timerSecsLeft : timerPausedLeft != null ? timerPausedLeft : 0;
  const timerActive = timerEndsAt != null || timerPausedLeft != null;

  const formatTimer = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  const startTimerFor = (minutes: number, stepIndex: number) => {
    const secs = Math.max(1, Math.min(180, Math.round(minutes))) * 60;
    const mins = Math.round(secs / 60);
    setTimerPresetMin(mins);
    setTimerInitialSecs(secs);
    setTimerPausedLeft(null);
    setTimerStepIndex(stepIndex);
    setTimerStepLabel(`第 ${stepIndex + 1} 步 · ${mins} 分钟`);
    timerDoneRef.current = null;
    setTimerEndsAt(Date.now() + secs * 1000);
    setTimerSecsLeft(secs);
    setTimerOpen(false);
    setTimerDonePulse(false);
    hapticTap();
    toast(`开始计时 ${Math.round(secs / 60)} 分钟`);
  };

  const pauseTimer = () => {
    if (timerEndsAt == null) return;
    const left = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
    setTimerEndsAt(null);
    setTimerPausedLeft(left);
    setTimerSecsLeft(left);
    hapticTap();
    toast("已暂停计时");
  };

  const resumeTimer = () => {
    if (timerPausedLeft == null || timerPausedLeft <= 0) return;
    setTimerEndsAt(Date.now() + timerPausedLeft * 1000);
    setTimerPausedLeft(null);
    hapticTap();
    toast("继续计时");
  };

  const resetTimer = () => {
    if (timerInitialSecs <= 0) {
      setTimerEndsAt(null);
      setTimerPausedLeft(null);
      setTimerSecsLeft(0);
      return;
    }
    setTimerPausedLeft(null);
    setTimerEndsAt(Date.now() + timerInitialSecs * 1000);
    setTimerSecsLeft(timerInitialSecs);
    setTimerDonePulse(false);
    hapticTap();
    toast("已重置计时");
  };

  const clearTimer = () => {
    setTimerEndsAt(null);
    setTimerPausedLeft(null);
    setTimerSecsLeft(0);
    setTimerInitialSecs(0);
    setTimerStepIndex(null);
    setTimerOpen(false);
    setTimerDonePulse(false);
    setTimerPresetMin(null);
    toast("已取消计时");
  };

  useEffect(() => {
    if (!cookMode) {
      setTimerOpen(false);
      setCookJustDone(false);
      setTimerPresetMin(null);
    }
  }, [cookMode]);

  useEffect(() => {
    if (!cookMode || !dish) {
      setCookJustDone(false);
      return;
    }
    const steps = recipeFor(dish).steps;
    if (steps.length === 0 || doneSteps.length < steps.length) {
      setCookJustDone(false);
      return;
    }
    setCookJustDone(true);
    hapticTap();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setCookJustDone(false), reduce ? 1400 : 2800);
    return () => window.clearTimeout(id);
  }, [cookMode, dish?.id, doneSteps.length]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  useEffect(() => {
    if (!lightbox) {
      setLightboxScale(1);
      lightboxPinchRef.current = null;
      return;
    }
    setLightboxScale(1);
    lightboxPinchRef.current = null;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lightboxCloseRef.current?.focus();
    const clampScale = (v: number) => Math.min(4, Math.max(1, v));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(false);
        return;
      }
      if (event.key !== "Tab") return;
      // Simple trap: only the close button is focusable in the lightbox
      event.preventDefault();
      lightboxCloseRef.current?.focus();
    };
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.(".photo-lightbox")) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.12 : 0.12;
      setLightboxScale((s) => clampScale(s + delta));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [lightbox]);


  /* Sticky mini jump · scroll-spy (before any early return — hooks order) */
  useEffect(() => {
    if (!dish || cookMode) return;
    const hasVideo = topVideosOf(dish, 1).length > 0;
    const root = document.querySelector(".app-scroll") as HTMLElement | null;
    const ids: Array<{ id: string; key: "video" | "ings" | "steps" }> = [
      ...(hasVideo ? [{ id: "dish-anchor-video", key: "video" as const }] : []),
      { id: "dish-anchor-ings", key: "ings" },
      { id: "dish-anchor-steps", key: "steps" },
    ];
    const els = ids
      .map((item) => ({ ...item, el: document.getElementById(item.id) }))
      .filter((item): item is typeof item & { el: HTMLElement } => Boolean(item.el));
    if (!els.length) return;

    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestKey: "video" | "ings" | "steps" | null = null;
        let bestRatio = 0;
        for (const item of els) {
          const r = ratios.get(item.id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestKey = item.key;
          }
        }
        if (bestKey) setActiveAnchor(bestKey);
      },
      { root: root ?? null, rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55, 0.75] },
    );
    for (const item of els) io.observe(item.el);
    return () => io.disconnect();
  }, [dish, cookMode]);

  if (!dish) {
    return <NotFound title="这道菜不在菜单里" hint="可能是链接过期或名字变了，回首页再找找。" />;
  }

  const recipe = recipeFor(dish);
  const cookComplete =
    cookMode && recipe.steps.length > 0 && doneSteps.length >= recipe.steps.length;

  /* Hardware back matches in-app: exit cook first, then leave detail. */
  useEffect(() => {
    if (!cookMode) return;
    cookSentinelRef.current = true;
    try {
      window.history.pushState({ jteCook: 1 }, "");
    } catch {
      cookSentinelRef.current = false;
      return;
    }
    const onPop = () => {
      const total = recipe.steps.length;
      const done = doneStepsRef.current.length;
      if (total > 0 && done < total) {
        const ok = window.confirm(
          `还有 ${total - done} 步没勾完，确定退出开做？计时会停掉。`,
        );
        if (!ok) {
          try {
            window.history.pushState({ jteCook: 1 }, "");
            cookSentinelRef.current = true;
          } catch {
            /* ignore */
          }
          return;
        }
      }
      cookSentinelRef.current = false;
      setCookMode(false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      /* Leaving the route while still in cook: drop sentinel flag without extra back. */
      if (cookSentinelRef.current) {
        cookSentinelRef.current = false;
        try {
          const state = window.history.state as { jteCook?: number } | null;
          if (state && state.jteCook === 1) window.history.replaceState(null, "");
        } catch {
          /* ignore */
        }
      }
    };
  }, [cookMode, recipe.steps.length]);

  const releaseCookSideEffects = useCallback(() => {
    stopCookSpeak();
    setTimerEndsAt(null);
    setTimerPausedLeft(null);
    setTimerSecsLeft(0);
    setTimerInitialSecs(0);
    setTimerStepIndex(null);
    setTimerOpen(false);
    setTimerDonePulse(false);
    setTimerPresetMin(null);
    const handle = wakeLockRef.current;
    wakeLockRef.current = null;
    try {
      void handle?.release?.();
    } catch {
      /* ignore */
    }
  }, []);

  const exitCook = useCallback((announce = true, force = false) => {
    if (!cookMode) return;
    const total = recipe.steps.length;
    const unfinished = total > 0 && doneSteps.length < total;
    if (unfinished && !force) {
      const ok = window.confirm(
        `还有 ${total - doneSteps.length} 步没勾完，确定退出开做？计时会停掉。`,
      );
      if (!ok) return;
    }
    releaseCookSideEffects();
    setCookMode(false);
    if (!unfinished && total > 0) {
      clearStepChecks(dish.id);
      setDoneSteps([]);
    }
    if (announce) toast(unfinished ? "已退出开做 · 计时已停" : "已退出开做");
    if (cookSentinelRef.current) {
      cookSentinelRef.current = false;
      try {
        window.history.back();
      } catch {
        /* ignore */
      }
    }
  }, [cookMode, toast, recipe.steps.length, doneSteps.length, releaseCookSideEffects, dish.id]);

  useEffect(() => {
    if (cookMode) return;
    /* Leaving cook by any path: stop timer, speak, wake lock */
    releaseCookSideEffects();
  }, [cookMode, releaseCookSideEffects]);


  const videos = topVideosOf(dish, 3);
  const bestVideo = videos[0];
  const moreVideos = videos.slice(1);
  const likes = likesOf(dish);
  const inMenu = state.menuDishIds.includes(dish.id);
  const liked = state.hearts.includes(dish.id);
  const tonightIds = state.menuDishIds;
  const tonightIdx = tonightIds.indexOf(dish.id);
  const tonightChain = tonightIdx >= 0 && tonightIds.length > 1;
  const goTonightDish = (dir: -1 | 1) => {
    if (!tonightChain) return;
    const nextId = tonightIds[tonightIdx + dir];
    if (!nextId) return;
    releaseCookSideEffects();
    cookSentinelRef.current = false;
    try {
      sessionStorage.setItem("jte.resume-cook", "1");
    } catch {
      /* ignore */
    }
    hapticTap();
    navigate(`/d/${encodeURIComponent(nextId)}`, { replace: true });
  };
  const showConfidenceNote = recipe.confidence !== "high";
  const sources = sourcesOf(dish);
  const bestCreator = bestVideo ? creatorOfVideo(bestVideo.url, dish.name) : "";
  const back = () => {
    if (cookMode) {
      exitCook(true);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const ingredientsText = () =>
    scaleIngredientsForCopy(dish.name, recipe.ingredients, servings, ingredientNote);

  const copyIngredients = async () => {
    if (recipe.unparsed || recipe.ingredients.length === 0) {
      toast("这道菜食材还不全，先对照视频");
      return;
    }
    const ok = await copyText(ingredientsText());
    toast(ok ? `已复制（按 ${servings} 人）` : "没能复制，请手动选择");
  };

  const shareIngredients = async () => {
    if (recipe.unparsed || recipe.ingredients.length === 0) {
      toast("这道菜食材还不全，先对照视频");
      return;
    }
    const text = ingredientsText();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${dish.name} · 食材`, text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const ok = await copyText(text);
    toast(ok ? "已复制" : "分享不可用，请手动复制");
  };

  const copySteps = async () => {
    if (recipe.steps.length === 0) {
      toast("这道菜还没有步骤");
      return;
    }
    const text = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
    const ok = await copyText(text);
    toast(ok ? "步骤已复制" : "没能复制，请手动选择");
  };

  const copyOneStep = async (index: number) => {
    const step = recipe.steps[index];
    if (!step) {
      toast("没有这一步");
      return;
    }
    const ok = await copyText(step);
    toast(ok ? "已复制" : "没能复制，请手动选择");
    if (ok) hapticTap();
  };

  const shareDish = async () => {
    const mains = recipe.ingredients
      .filter((item) => item.role === "main")
      .map((item) => item.name);
    const payload = buildDishShareText({
      name: dish.name,
      minutes: recipe.minutes,
      tags: recipe.tags,
      ingredients: mains.length ? mains : recipe.ingredients.map((item) => item.name),
      refined: recipe.fromOverride,
    });
    await shareOrCopy(payload, toast);
  };

  const flashHeart = (mode: "add" | "remove") => {
    setHeartFlash(mode);
    window.setTimeout(() => setHeartFlash((cur) => (cur === mode ? null : cur)), 560);
  };

  /** Double-click / double-tap → lightbox. Want stays on ♥ button (no accidental heart). */
  const openLightbox = () => {
    if (!coverSrc) return;
    setLightbox(true);
  };
  const onHeroDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      openLightbox();
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <div className={cookMode ? "page dish-page is-cook" : "page dish-page"}>
      <header className="subhead">
        <button type="button" className="icon-btn" onClick={back} aria-label="返回">
          <BackIcon />
        </button>
        <Link className="crumb" to={`/c/${encodeURIComponent(dish.category)}`}>
          {dish.category}
        </Link>
        <ThemeButton />
      </header>

      <div
        className={[
          "dish-hero",
          bestVideo ? "has-douyin" : "",
          videoOpened ? "is-video-opened" : "",
          heroAmbience ? "has-ambience" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          ["--hero-parallax" as string]: `${parallaxY}px`,
          ["--hero-ambience" as string]: heroAmbience ?? "transparent",
        }}
      >
        <div className="hero-stage">
          {coverSrc ? (
            <button
              type="button"
              className="hero-art hero-art-btn"
              onDoubleClick={(event) => {
                event.preventDefault();
                openLightbox();
              }}
              onClick={onHeroDoubleTap}
              aria-label={`双击查看「${dish.name}」大图`}
              title="双击放大封面"
            >
              <DishArt name={dish.name} category={dish.category} priority lazy={false} />
              {bestVideo ? <span className="hero-cover-dim" aria-hidden="true" /> : null}
              {heartFlash && (
                <span
                  className={heartFlash === "remove" ? "hero-heart-flash on-remove" : "hero-heart-flash"}
                  aria-hidden="true"
                >
                  ♥
                </span>
              )}
            </button>
          ) : (
            <div className="hero-art" aria-hidden="true">
              <DishArt name={dish.name} category={dish.category} priority lazy={false} />
            </div>
          )}
          {bestVideo && coverSrc ? (
            <a
              className={videoOpened ? "hero-play-affordance is-opened" : "hero-play-affordance"}
              href={bestVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="打开抖音教程"
              onClick={(event) => {
                if (!requireOnline(toast)) {
                  event.preventDefault();
                  return;
                }
                setVideoOpened(true);
                hapticTap();
              }}
            >
              <span className="hero-play-disk" aria-hidden="true">
                ▶
              </span>
            </a>
          ) : null}
        </div>
        <p className="hero-source" aria-label="图片来源">
          {sources.length > 0 ? sources.join(" · ") : "视频封面"}
        </p>
      </div>

      {lightbox && coverSrc && (
        <div
          className="photo-lightbox modal-layer"
          role="dialog"
          aria-modal="true"
          aria-label={`${dish.name} 大图`}
          onClick={() => setLightbox(false)}
          onTouchStart={(event) => {
            if (event.touches.length === 2) {
              const a = event.touches[0]!;
              const b = event.touches[1]!;
              const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
              lightboxPinchRef.current = { dist: Math.max(1, dist), scale: lightboxScale };
            }
          }}
          onTouchMove={(event) => {
            if (event.touches.length !== 2 || !lightboxPinchRef.current) return;
            event.preventDefault();
            const a = event.touches[0]!;
            const b = event.touches[1]!;
            const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const next = lightboxPinchRef.current.scale * (dist / lightboxPinchRef.current.dist);
            setLightboxScale(Math.min(4, Math.max(1, next)));
          }}
          onTouchEnd={() => {
            lightboxPinchRef.current = null;
          }}
        >
          <button
            type="button"
            className="photo-lightbox-close"
            aria-label="关闭大图"
            ref={lightboxCloseRef}
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
          <img
            src={coverSrc}
            alt={dish.name}
            className="photo-lightbox-img modal-panel"
            style={{
              objectFit: "contain",
              transform: `scale(${lightboxScale})`,
              transition: "transform 0.08s ease-out",
              cursor: lightboxScale > 1.02 ? "zoom-out" : "zoom-in",
            }}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (lightboxScale > 1.05) {
                setLightboxScale(1);
              } else {
                setLightbox(false);
              }
            }}
            draggable={false}
          />
          <div className="photo-lightbox-caption" onClick={(event) => event.stopPropagation()}>
            <strong className="photo-lightbox-name">{dish.name}</strong>
            <p className="photo-lightbox-hint" aria-hidden="true">
              {lightboxScale > 1.05 ? "双击还原 · Esc 关闭" : "滚轮 / 捏合缩放 · 双击关闭"}
            </p>
          </div>
        </div>
      )}

      <div className="dish-head">
        <h1 className="dish-title">{dish.name}</h1>
        <p className="meta-row">
          {recipe.fromOverride && <span className="pill refine-pill">精修</span>}
          <span className="pill">约 {recipe.minutes} 分钟</span>
          {recipe.tags.map((tag) => (
            <span key={tag} className="pill">
              {tag}
            </span>
          ))}
          {recipe.confidence !== "high" && <span className="pill quiet">时长大概估的</span>}
        </p>
      </div>

      <div className="action-row dish-actions dish-actions-bar">
        <button
          type="button"
          className="btn-primary grow"
          onClick={() => {
            if (!oncePrimary("dish-tonight")) return;
            if (inMenu) {
              const snap = removeDishFromMenu(dish.id);
              hapticTap();
              if (snap) {
                toast("已从今晚拿下", {
                  ms: 7000,
                  undo: () => {
                    const ok = insertDishAtMenu(dish.id, snap.index, snap.undoToken);
                    toast(ok ? "已恢复到今晚菜单" : "撤销已失效");
                  },
                });
              }
            } else {
              addDishToMenu(dish.id);
              hapticTap();
              toast("放进今晚菜单了");
            }
          }}
        >
          {inMenu ? "已在今晚菜单" : "今晚就做"}
        </button>
        <button
          type="button"
          className={liked ? "btn-ghost on-heart cook-keep" : "btn-ghost cook-keep"}
          aria-pressed={liked}
          onClick={() => {
            if (liked) {
              const snap = removeHeart(dish.id);
              hapticTap();
              flashHeart("remove");
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
              flashHeart("add");
              toast(`想吃「${dish.name}」`);
            }
          }}
        >
          <HeartIcon filled={liked} />
          想吃
        </button>
        <button
          type="button"
          className={cookMode ? "btn-ghost cook-toggle is-on cook-keep" : "btn-ghost cook-toggle cook-keep"}
          aria-pressed={cookMode}
          onClick={() => {
            if (cookMode) {
              exitCook(false);
              return;
            }
            setCookStep(0);
            setCookMode(true);
          }}
        >
          {cookMode ? "退出开做" : "开做"}
        </button>
        {cookMode ? (
          <button
            type="button"
            className={cookWakePref ? "btn-ghost cook-wake-toggle is-on cook-keep" : "btn-ghost cook-wake-toggle cook-keep"}
            aria-pressed={cookWakePref}
            title={
              isWakeLockSupported()
                ? "开做时尽量不让屏幕休眠"
                : "这台设备可能不支持屏幕常亮"
            }
            onClick={() => {
              const next = !cookWakePref;
              setCookWakePref(next);
              saveCookWake(next);
              wakeHintShown.current = false;
              if (next && !isWakeLockSupported()) {
                toast("这台设备不支持屏幕常亮");
              } else {
                toast(next ? "已开屏幕常亮" : "已关屏幕常亮");
              }
              hapticTap();
            }}
          >
            屏幕常亮
          </button>
        ) : null}
        <div className="more-menu cook-hide">
          <button
            type="button"
            className={moreOpen ? "btn-ghost more-toggle is-on" : "btn-ghost more-toggle"}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((v) => !v)}
          >
            更多
          </button>
          {moreOpen ? (
            <div className="more-pop" role="menu">
              <Link
                role="menuitem"
                className="more-item"
                to={`/ledger/new?name=${encodeURIComponent(dish.name)}&ingredients=${encodeURIComponent(
                  recipe.ingredients
                    .filter((item) => item.role === "main")
                    .map((item) => item.name)
                    .join("\n"),
                )}`}
                onClick={() => setMoreOpen(false)}
              >
                抄进账本
              </Link>
              <button
                type="button"
                role="menuitem"
                className="more-item"
                onClick={() => {
                  setMoreOpen(false);
                  void shareDish();
                }}
              >
                分享链接
              </button>
              <button
                type="button"
                role="menuitem"
                className="more-item"
                onClick={() => {
                  setMoreOpen(false);
                  void copyIngredients();
                }}
              >
                复制食材
              </button>
              <button
                type="button"
                role="menuitem"
                className="more-item"
                onClick={() => {
                  setMoreOpen(false);
                  void shareIngredients();
                }}
              >
                分享食材
              </button>
              <button
                type="button"
                role="menuitem"
                className="more-item"
                onClick={() => {
                  setMoreOpen(false);
                  void copySteps();
                }}
              >
                复制步骤
              </button>
              <button
                type="button"
                role="menuitem"
                className="more-item"
                onClick={() => {
                  setMoreOpen(false);
                  window.print();
                }}
              >
                打印此页
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {cookMode && recipe.steps.length > 0 && (
        <div
          className={[
            "cook-progress",
            cookComplete ? "is-cook-complete" : "",
            cookJustDone ? "is-cook-just-done" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {cookComplete ? (
            <div className="cook-done-banner">
              <span className="cook-done-mark" aria-hidden="true">
                ✓
              </span>
              <div className="cook-done-copy">
                <strong>这道做好了</strong>
                <p>步骤都勾完了，可以回详情或记进账本。</p>
              </div>
              <div className="cook-done-actions">
                {tonightChain && tonightIdx < tonightIds.length - 1 ? (
                  <button
                    type="button"
                    className="btn-primary cook-nav-btn"
                    onClick={() => goTonightDish(1)}
                  >
                    下一道
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary cook-nav-btn"
                  onClick={() => {
                    exitCook(false);
                    hapticTap();
                  }}
                >
                  回到详情
                </button>
                <button
                  type="button"
                  className="btn-ghost cook-nav-btn"
                  onClick={() => {
                    if (!oncePrimary("cook-ledger")) return;
                    const dateLabel = new Intl.DateTimeFormat("zh-CN", {
                      timeZone: "Asia/Shanghai",
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                    }).format(new Date());
                    const now = Date.now();
                    saveLedger({
                      id: crypto.randomUUID(),
                      name: dish.name,
                      notes: `烹饪完成 · ${dateLabel}`,
                      ingredients: recipe.ingredients
                        .filter((item) => item.role === "main")
                        .map((item) => item.name)
                        .join("\n"),
                      createdAt: now,
                      updatedAt: now,
                    });
                    hapticTap();
                    toast("已记入账本");
                  }}
                >
                  记入账本
                </button>
              </div>
            </div>
          ) : null}
          <div className="cook-progress-top">
            <span className={cookComplete ? "cook-progress-label is-done" : "cook-progress-label"}>
              <strong className="cook-progress-step">
                {cookComplete
                  ? "全部完成"
                  : `第 ${cookStep + 1}/${recipe.steps.length} 步`}
              </strong>
              <em className="cook-progress-pct" aria-label="完成进度">
                {doneSteps.length}/{recipe.steps.length}
                <span className="cook-progress-sep">·</span>
                <span className="cook-progress-pct-num">
                  {recipe.steps.length
                    ? Math.round((doneSteps.length / recipe.steps.length) * 100)
                    : 0}
                  %
                </span>
              </em>
            </span>
            <div className="cook-dots" aria-hidden="true">
              {recipe.steps.map((_, index) => (
                <button
                  key={`dot-${index}`}
                  type="button"
                  className={
                    index === cookStep
                      ? doneSteps.includes(index)
                        ? "cook-dot is-on is-checked"
                        : "cook-dot is-on"
                      : doneSteps.includes(index)
                        ? "cook-dot is-done"
                        : "cook-dot"
                  }
                  tabIndex={-1}
                  onClick={() => setCookStep(index)}
                />
              ))}
            </div>
          </div>
          {tonightChain ? (
            <div className="cook-tonight-switch" role="group" aria-label="今晚菜单切换">
              <button
                type="button"
                className="btn-ghost cook-nav-btn"
                disabled={tonightIdx <= 0}
                onClick={() => goTonightDish(-1)}
                title="今晚上一道"
              >
                上一道
              </button>
              <span className="cook-tonight-pos">
                今晚 {tonightIdx + 1}/{tonightIds.length}
              </span>
              <button
                type="button"
                className="btn-ghost cook-nav-btn"
                disabled={tonightIdx >= tonightIds.length - 1}
                onClick={() => goTonightDish(1)}
                title="今晚下一道"
              >
                下一道
              </button>
            </div>
          ) : null}
          <div className="cook-progress-actions">
            <button
              type="button"
              className="btn-ghost cook-nav-btn"
              disabled={cookStep <= 0}
              onClick={() => setCookStep((s) => Math.max(0, s - 1))}
            >
              上一步
            </button>
                          {loadCookSpeak() && canSpeak() ? (
                <button
                  type="button"
                  className="btn-ghost cook-nav-btn cook-speak-btn"
                  onClick={() => {
                    const text = recipe.steps[cookStep] || "";
                    const ok = speakCookStep(`第 ${cookStep + 1} 步。${text}`);
                    toast(ok ? "正在读出本步" : "朗读不可用");
                    hapticTap();
                  }}
                  title="用系统语音读出本步（不自动朗读）"
                >
                  读出本步
                </button>
              ) : null}
            <button
              type="button"
              className="btn-ghost cook-nav-btn cook-copy-one"
              onClick={() => void copyOneStep(cookStep)}
              title="复制当前步骤纯文本"
            >
              复制本步
            </button>
<button
              type="button"
              className={doneSteps.includes(cookStep) ? "btn-ghost cook-nav-btn is-step-mark" : "btn-secondary cook-nav-btn"}
              onClick={() => {
                const wasDone = doneSteps.includes(cookStep);
                const nextDone = toggleStepCheck(dish.id, cookStep);
                setDoneSteps(nextDone);
                hapticTap();
                if (!wasDone) {
                  setCookStep(firstIncompleteStep(nextDone, recipe.steps.length));
                }
              }}
            >
              {doneSteps.includes(cookStep) ? "取消勾选" : "完成本步"}
            </button>
            <button
              type="button"
              className="btn-ghost cook-nav-btn"
              disabled={cookStep >= recipe.steps.length - 1}
              onClick={() => setCookStep((s) => Math.min(recipe.steps.length - 1, s + 1))}
            >
              {cookStep >= recipe.steps.length - 1 ? "最后一步" : "下一步"}
            </button>
            <button
              type="button"
              className="btn-ghost cook-nav-btn cook-copy-steps"
              onClick={() => void copySteps()}
              title="复制全部步骤，不用退出烹饪模式"
            >
              复制步骤
            </button>
          </div>
          <p className="hint cook-wake-hint cook-keep" role="note">
            屏幕常亮已尽量开启 · 勾选步骤只记在本机
          </p>
          <div className={timerDonePulse ? "cook-timer is-done-pulse" : "cook-timer"}>
            {timerActive ? (
              <div
                className={timerPausedLeft != null ? "cook-timer-running is-paused" : "cook-timer-running"}
                role="timer"
                aria-live="polite"
                aria-label={timerPausedLeft != null ? "计时已暂停" : "计时进行中"}
              >
                <strong className="cook-timer-digits">{formatTimer(timerDisplaySecs)}</strong>
                <span className="cook-timer-label">{timerStepLabel || (timerPausedLeft != null ? "已暂停" : "计时中")}</span>
                {timerPresetMin != null ? (
                  <span className="cook-timer-preset" title="当前预设">
                    预设 {timerPresetMin} 分钟
                    {[1, 3, 5, 10].includes(timerPresetMin) ? "" : " · 自定义"}
                  </span>
                ) : null}
                <div className="cook-timer-actions">
                  {timerEndsAt != null ? (
                    <button type="button" className="btn-secondary compact" onClick={pauseTimer}>
                      暂停
                    </button>
                  ) : (
                    <button type="button" className="btn-secondary compact" onClick={resumeTimer}>
                      继续
                    </button>
                  )}
                  <button type="button" className="btn-ghost compact" onClick={resetTimer}>
                    重置
                  </button>
                  <button type="button" className="btn-ghost compact" onClick={clearTimer}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={timerOpen ? "btn-secondary compact" : "btn-ghost compact"}
                  aria-expanded={timerOpen}
                  onClick={() => setTimerOpen((v) => !v)}
                >
                  {timerOpen ? "收起计时" : "计时"}
                </button>
                {timerOpen && (
                  <div className="cook-timer-picks" role="group" aria-label="快捷计时">
                    {[1, 3, 5, 10].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={timerPresetMin === m ? "chip on" : "chip"}
                        aria-pressed={timerPresetMin === m}
                        onClick={() => startTimerFor(m, cookStep)}
                      >
                        {m} 分
                      </button>
                    ))}
                    <label className="cook-timer-custom">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        inputMode="numeric"
                        value={timerCustom}
                        onChange={(e) => setTimerCustom(e.target.value)}
                        aria-label="自定义分钟"
                      />
                      <button
                        type="button"
                        className={
                          timerPresetMin != null && ![1, 3, 5, 10].includes(timerPresetMin)
                            ? "chip on"
                            : "chip"
                        }
                        onClick={() => {
                          const m = Math.max(1, Math.min(180, Math.round(Number(timerCustom) || 0)));
                          if (!Number.isFinite(m) || m < 1) {
                            toast("填 1–180 分钟");
                            return;
                          }
                          setTimerCustom(String(m));
                          startTimerFor(m, cookStep);
                        }}
                      >
                        开始
                      </button>
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}


      {!cookMode && (
        <nav className="dish-jump" aria-label="详情跳转">
          {bestVideo ? (
            <button
              type="button"
              className={activeAnchor === "video" ? "dish-jump-btn is-on" : "dish-jump-btn"}
              onClick={() => {
                document.getElementById("dish-anchor-video")?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveAnchor("video");
              }}
            >
              视频
            </button>
          ) : null}
          <button
            type="button"
            className={activeAnchor === "ings" ? "dish-jump-btn is-on" : "dish-jump-btn"}
            onClick={() => {
              document.getElementById("dish-anchor-ings")?.scrollIntoView({ behavior: "smooth", block: "start" });
              setActiveAnchor("ings");
            }}
          >
            食材
          </button>
          <button
            type="button"
            className={activeAnchor === "steps" ? "dish-jump-btn is-on" : "dish-jump-btn"}
            onClick={() => {
              document.getElementById("dish-anchor-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
              setActiveAnchor("steps");
            }}
          >
            做法
          </button>
        </nav>
      )}

      {bestVideo && (
        <section id="dish-anchor-video" className="video-block" aria-label="教程视频">
          <p className="video-block-label">抖音教程</p>
          <a
            className={[
              "video-hero",
              coverSrc ? "has-thumb" : "",
              videoOpened ? "is-opened" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            href={bestVideo.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (!requireOnline(toast)) {
                event.preventDefault();
                return;
              }
              setVideoOpened(true);
              hapticTap();
            }}
          >
            {coverSrc ? (
              <span className="video-hero-thumb">
                <img src={coverSrc} alt="" loading="lazy" decoding="async" />
                <span className="video-hero-play" aria-hidden="true">
                  ▶
                </span>
              </span>
            ) : (
              <span className="video-hero-play" aria-hidden="true">
                ▶
              </span>
            )}
            <span className="video-hero-body">
              <strong>看完整教程</strong>
              <em>
                {bestCreator ? `${bestCreator} · ` : ""}
                {(() => { const raw = bestVideo.likes || ""; const n = raw.includes("万") ? Number.parseFloat(raw) * 10000 : Number.parseFloat(raw); const c = formatLikesCompact(Number.isFinite(n) ? n : 0, raw); return c ? `${c}赞 · ` : ""; })()}
                {bestVideo.title || dish.name}
              </em>
            </span>
          </a>

          {moreVideos.length > 0 && (
            <ul className="video-list compact">
              {moreVideos.map((video) => {
                const creator = creatorOfVideo(video.url, dish.name);
                return (
                  <li key={video.url}>
                    <a
                      className="video-link video-link-secondary"
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        if (!requireOnline(toast)) event.preventDefault();
                      }}
                    >
                      <span className="play-circle soft" aria-hidden="true">
                        ▶
                      </span>
                      <span>
                        <strong>
                          {creator}
                          {(() => { const raw = video.likes || ""; const n = raw.includes("万") ? Number.parseFloat(raw) * 10000 : Number.parseFloat(raw); const c = formatLikesCompact(Number.isFinite(n) ? n : 0, raw); return c ? ` · ${c}赞` : ""; })()}
                        </strong>
                        <em>{video.title || dish.name}</em>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          {videos.length >= 3 && (
            <p className="hint video-more-hint">按点赞挑了前三；点开会去抖音看完整教程。</p>
          )}
        </section>
      )}

      {showConfidenceNote && (
        <aside className={recipe.unparsed ? "template-note soft" : "template-note whisper"}>
          {recipe.unparsed ? (
            <p>主料还对不太准，先看上面的视频再决定买什么；做顺了就抄进账本。</p>
          ) : (
            <p>步骤按家常写法整理过，火候和份量仍以视频为准。</p>
          )}
        </aside>
      )}

      <div className="dish-recipe-split">
        <section id="dish-anchor-ings" className="dish-body-ings" aria-label="食材">
        <div className="block-head">
          <h2 className="block-title">食材</h2>
          {/* 复制/分享食材 → 上方「更多」，主路径留给勾选与盒马搜 */}
        </div>
        <p className="print-servings" aria-hidden="true">
          按 {servings} 人
          {servings !== baseServings() ? " · 用量已按人数缩放（仅展示）" : " · 默认两人份心估"}
        </p>
        {!recipe.unparsed && recipe.ingredients.length > 0 && (
          <div className="servings-bar" role="group" aria-label="按几人估算用量">
            <span className="servings-label">按几人</span>
            <button
              type="button"
              className="icon-btn servings-btn"
              aria-label="减少人数"
              disabled={servings <= MIN_SERVINGS}
              onClick={() => {
                setServings((n) => {
                  const next = clampServings(n - 1);
                  if (next !== n) {
                    setServingsPulse(true);
                    window.setTimeout(() => setServingsPulse(false), 320);
                    if (dish) saveServingsForDish(dish.id, next);
                  }
                  return next;
                });
                hapticTap();
              }}
            >
              −
            </button>
            <strong className="servings-value" aria-live="polite">
              <span className="servings-n">{servings}</span>
              <span className="servings-unit">人</span>
            </strong>
            <button
              type="button"
              className="icon-btn servings-btn"
              aria-label="增加人数"
              disabled={servings >= MAX_SERVINGS}
              onClick={() => {
                setServings((n) => {
                  const next = clampServings(n + 1);
                  if (next !== n) {
                    setServingsPulse(true);
                    window.setTimeout(() => setServingsPulse(false), 320);
                    if (dish) saveServingsForDish(dish.id, next);
                  }
                  return next;
                });
                hapticTap();
              }}
            >
              +
            </button>
            <span className="servings-hint">按 {servings} 人 · 用量仅展示缩放，不改菜谱底稿</span>
          </div>
        )}
        {recipe.unparsed ? (
          <p className="hint">主料待对照视频。先看抖音再决定买什么。</p>
        ) : (
          <ul className={servingsPulse ? "ing-list is-servings-pulse" : "ing-list"}>
            {recipe.ingredients.map((ingredient) => {
              const checked = checkedNames.includes(ingredient.name);
              const displayName = scaleAmountText(ingredient.name, servings);
              const displayNote = scaleIngredientNote(ingredientNote(ingredient), servings);
              const scaled = servings !== baseServings();
              return (
                <li key={ingredient.name} className={checked ? "ing-item is-checked" : "ing-item"}>
                  <label className={checked ? "ing-row is-on" : "ing-row"}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setCheckedNames(toggleIngCheck(dish.id, ingredient.name));
                        hapticTap();
                      }}
                    />
                    <span className={scaled ? "ing-name is-scaled" : "ing-name"}>{displayName}</span>
                    <span className="ing-note">{displayNote}</span>
                  </label>
                  <button
                    type="button"
                    className="hema-btn"
                    onClick={() => openHema(ingredient.name, state.hemaTemplate, toast)}
                    title={`复制并打开盒马搜索「${hemaSearchTerm(ingredient.name) || ingredient.name}」· 不是一键加购`}
                    aria-label={`在盒马搜「${hemaSearchTerm(ingredient.name) || ingredient.name}」，仅搜索不是加购`}
                  >
                    <span className="hema-btn-main">在盒马搜</span>
                    <span className="hema-btn-q">搜「{hemaSearchTerm(ingredient.name) || ingredient.name}」</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint hema-honest-hint">勾过表示这道菜你已经备好，只记在本机，刷新同菜还在；不会进情侣同步，也不会改采购清单。<strong>「在盒马搜」</strong>会复制关键词并打开搜索页（顺带试一次唤起 App）——只是搜索/深链，没有公开加购接口，不会假装放进购物车；唤不起就打开盒马 App 粘贴最省事。</p>
        </section>
        <section id="dish-anchor-steps" className="dish-body-steps" aria-label="做法">
        <div className="block-head">
          <h2 className="block-title">做法</h2>
          {/* 复制步骤 → 「更多」；开做时底部坞仍可复制 */}
        </div>
        <ol className="steps">
          {recipe.steps.map((step, index) => {
            const stepDone = doneSteps.includes(index);
            const current = cookMode && index === cookStep;
            return (
              <li
                key={`${index}-${step.slice(0, 12)}`}
                ref={(el) => {
                  stepRefs.current[index] = el;
                }}
                className={[current ? "is-current" : "", stepDone ? "is-step-done" : ""]
                  .filter(Boolean)
                  .join(" ") || undefined}
              >
                <label className="step-check">
                  <input
                    type="checkbox"
                    checked={stepDone}
                    aria-label={stepDone ? `第 ${index + 1} 步已完成，点按取消` : `第 ${index + 1} 步未完成，点按勾选`}
                    onChange={() => {
                      const nextDone = toggleStepCheck(dish.id, index);
                      setDoneSteps(nextDone);
                      hapticTap();
                      if (cookMode && !stepDone) {
                        setCookStep(firstIncompleteStep(nextDone, recipe.steps.length));
                      } else if (cookMode) {
                        setCookStep(index);
                      }
                    }}
                  />
                  <span className="num" aria-hidden="true">
                    {index + 1}
                  </span>
                </label>
                <div className="step-main">
                  <p
                    onClick={cookMode ? () => setCookStep(index) : undefined}
                    className={cookMode ? "step-body is-tappable" : "step-body"}
                  >
                    <RichText text={step} />
                  </p>
                  <div className="step-tools">
                  <button
                    type="button"
                    className="step-copy-btn"
                    aria-label={`复制第 ${index + 1} 步`}
                    title="复制这一步"
                    onClick={(event) => {
                      event.stopPropagation();
                      void copyOneStep(index);
                    }}
                  >
                    复制
                  </button>
                  {cookMode && (
                    <button
                      type="button"
                      className={[
                        "step-timer-btn",
                        timerActive && timerStepIndex === index ? "is-active" : "",
                        timerPausedLeft != null && timerStepIndex === index ? "is-paused" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={
                        timerActive && timerStepIndex === index
                          ? `第 ${index + 1} 步计时 ${formatTimer(timerDisplaySecs)}`
                          : `为第 ${index + 1} 步计时`
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        setCookStep(index);
                        if (timerActive && timerStepIndex === index) {
                          /* Focus dock controls; don't steal checklist taps */
                          setTimerOpen(false);
                          document.querySelector(".cook-timer")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                        } else {
                          setTimerOpen(true);
                          /* Quick-start 3 min for this step if idle */
                          if (!timerActive) {
                            /* open picks only — user chooses duration */
                          }
                        }
                        hapticTap();
                      }}
                    >
                      {timerActive && timerStepIndex === index
                        ? formatTimer(timerDisplaySecs)
                        : "计时"}
                    </button>
                  )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        </section>
      </div>


      {(() => {
        const related = dishesIn(dish.category)
          .filter((item) => item.id !== dish.id)
          .slice(0, 6);
        if (related.length === 0) return null;
        return (
          <section className="panel related-dishes" aria-label="同分类看看">
            <h2 className="block-title">同分类看看</h2>
            <p className="hint">同属「{dish.category}」，封面按需加载。</p>
            <div className="dish-grid is-related-grid">
              {related.map((item) => (
                <DishCard key={item.id} dish={item} priority={false} />
              ))}
            </div>
          </section>
        );
      })()}

      {formatLikesCompact(likes.n, likes.label) && videos.length > 0 && (
        <p className="hint">样例里最高大约 {formatLikesCompact(likes.n, likes.label)}赞。有的片子是合集，以标题为准。</p>
      )}
    </div>
  );
}
