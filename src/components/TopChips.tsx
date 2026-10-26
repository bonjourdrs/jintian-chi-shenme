import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { isOnline } from "../lib/online.ts";
import { loadRoomMeta } from "../lib/coupleSync.ts";
import { useApp } from "../state/store.tsx";

const INSTALL_DISMISS_KEY = "jte-pwa-tip-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type ChipId = "offline" | "update" | "install" | "sync";

type ChipItem = {
  id: ChipId;
  priority: number;
  node: ReactNode;
  overflowToast: string;
};

function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function installWasDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch {
    return true;
  }
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const crios = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !crios;
}

/**
 * Top status chips: offline / update / install / sync.
 * Priority stack, max 2 visible; overflow goes to a one-shot toast.
 * Never overlaps the title — absolute stack under accent bar.
 */
export function TopChips() {
  const { toast } = useApp();
  const [offline, setOffline] = useState(() =>
    typeof navigator === "undefined" ? false : !isOnline(),
  );
  /* Session-only: hide offline bar until reconnect; never swallow UpdateChip */
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const wasOffline = useRef(offline);
  const reconnectToastAt = useRef(0);

  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const reloadArmed = useRef(false);

  const [installVisible, setInstallVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosInstall, setIosInstall] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const overflowToasted = useRef<string>("");

  /* Offline */
  useEffect(() => {
    const sync = () => {
      const next = !isOnline();
      const prev = wasOffline.current;
      wasOffline.current = next;
      setOffline(next);
      if (prev && !next) {
        /* Re-arm offline tip for a later dropout; sync/update chips stay independent */
        setOfflineDismissed(false);
        const now = Date.now();
        if (now - reconnectToastAt.current > 8000) {
          reconnectToastAt.current = now;
          toast("已重新联网", { ms: 2200 });
        }
        try {
          if (loadRoomMeta()) {
            window.dispatchEvent(new CustomEvent("jte-sync-status", { detail: { phase: "pending" } }));
            window.dispatchEvent(new CustomEvent("jte-reconnect-sync"));
          }
        } catch {
          /* ignore */
        }
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [toast]);

  /* Update SW */
  const armWaiting = useCallback((worker: ServiceWorker | null | undefined) => {
    if (!worker || worker.state === "redundant") {
      setWaiting(null);
      return;
    }
    setWaiting(worker);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let pollId = 0;
    const cleanups: Array<() => void> = [];

    const onControllerChange = () => {
      if (!reloadArmed.current) return;
      reloadArmed.current = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    cleanups.push(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    });

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onState = () => {
        if (cancelled) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          armWaiting(worker);
        } else if (worker.state === "activated" || worker.state === "redundant") {
          setWaiting((cur) => (cur === worker ? null : cur));
        }
      };
      worker.addEventListener("statechange", onState);
      cleanups.push(() => worker.removeEventListener("statechange", onState));
      onState();
    };

    const trackReg = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        armWaiting(reg.waiting);
      } else if (reg.waiting && !navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      if (reg.installing) watchWorker(reg.installing);
      const onUpdateFound = () => watchWorker(reg.installing);
      reg.addEventListener("updatefound", onUpdateFound);
      cleanups.push(() => reg.removeEventListener("updatefound", onUpdateFound));

      const tick = () => {
        void reg.update().catch(() => undefined);
      };
      tick();
      pollId = window.setInterval(tick, 60 * 60 * 1000);
      const onVis = () => {
        if (document.visibilityState === "visible") tick();
      };
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
    };

    void (async () => {
      try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg && import.meta.env.PROD) {
          reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
        }
        if (cancelled || !reg) return;
        trackReg(reg);
      } catch {
        /* offline / blocked */
      }
    })();

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      for (const fn of cleanups) fn();
    };
  }, [armWaiting]);

  const applyUpdate = () => {
    if (!waiting || updateBusy) return;
    setUpdateBusy(true);
    reloadArmed.current = true;
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      reloadArmed.current = false;
      setUpdateBusy(false);
      window.location.reload();
      return;
    }
    window.setTimeout(() => {
      if (!reloadArmed.current) return;
      reloadArmed.current = false;
      window.location.reload();
    }, 1200);
  };

  /* Install (compact chip in stack; suppress inline InstallHint via event) */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || installWasDismissed()) return;
    const narrow = window.matchMedia("(max-width: 879px)").matches;
    if (!narrow) return;

    if (isIosSafari()) {
      setIosInstall(true);
      setInstallVisible(true);
    }
    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setInstallVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    /* Tell InstallHint to stay hidden — TopChips owns install when visible */
    window.dispatchEvent(
      new CustomEvent("jte-topchips-install", { detail: { owned: installVisible } }),
    );
  }, [installVisible]);

  const dismissInstall = () => {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setInstallVisible(false);
    setDeferred(null);
  };

  const doInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* dismissed */
    }
    setDeferred(null);
    dismissInstall();
  };

  /* Sync phase — only when actively syncing / pending with a room */
  useEffect(() => {
    const onSync = (event: Event) => {
      const phase = (event as CustomEvent<{ phase?: string }>).detail?.phase;
      const room = (() => {
        try {
          return Boolean(loadRoomMeta());
        } catch {
          return false;
        }
      })();
      setSyncing(room && (phase === "pending" || phase === "syncing"));
    };
    window.addEventListener("jte-sync-status", onSync as EventListener);
    return () => window.removeEventListener("jte-sync-status", onSync as EventListener);
  }, []);

  const items: ChipItem[] = [];
  if (offline && !offlineDismissed) {
    items.push({
      id: "offline",
      priority: 1,
      overflowToast: "当前离线 · 菜单·今晚·想吃·账本仍可看",
      node: (
        <div className="offline-chip top-chip-item is-dismissible" role="status" aria-live="polite">
          <span className="offline-chip-dot" aria-hidden="true" />
          <span>离线可用</span>
          <em>菜单·今晚·想吃·账本仍可看</em>
          <button
            type="button"
            className="offline-chip-dismiss"
            aria-label="收起离线提示"
            title="本会话内不再显示"
            onClick={() => setOfflineDismissed(true)}
          >
            收起
          </button>
        </div>
      ),
    });
  }
  if (waiting) {
    items.push({
      id: "update",
      priority: 2,
      overflowToast: "有新版本可刷新",
      node: (
        <button
          type="button"
          className="update-chip top-chip-item"
          onClick={applyUpdate}
          disabled={updateBusy}
          aria-live="polite"
        >
          <span className="update-chip-dot" aria-hidden="true" />
          <span>{updateBusy ? "正在更新…" : "有新版本 · 刷新"}</span>
        </button>
      ),
    });
  }
  if (installVisible) {
    items.push({
      id: "install",
      priority: 3,
      overflowToast: iosInstall
        ? "可添加到主屏幕：底部分享 → 添加到主屏幕"
        : "可以把「今天吃什么」装到主屏幕",
      node: (
        <div className="install-chip top-chip-item" role="status">
          <span className="install-chip-label">
            {iosInstall ? "可固定到主屏幕" : deferred ? "可安装到主屏幕" : "可添加到主屏幕"}
          </span>
          <div className="install-chip-actions">
            {deferred ? (
              <button type="button" className="linkish" onClick={() => void doInstall()}>
                安装
              </button>
            ) : null}
            <button type="button" className="linkish" onClick={dismissInstall}>
              关闭
            </button>
          </div>
        </div>
      ),
    });
  }
  if (syncing) {
    items.push({
      id: "sync",
      priority: 4,
      overflowToast: "正在同步给对方…",
      node: (
        <div className="sync-top-chip top-chip-item is-syncing" role="status" aria-live="polite">
          <span className="sync-chip-dot" aria-hidden="true" />
          <span>同步中…</span>
        </div>
      ),
    });
  }

  items.sort((a, b) => a.priority - b.priority);
  const visible = items.slice(0, 2);
  const overflow = items.slice(2);
  const overflowKey = overflow.map((c) => c.id).join(",");
  const overflowMsg = overflow.map((c) => c.overflowToast).join("；");

  useEffect(() => {
    if (!overflowKey) {
      overflowToasted.current = "";
      return;
    }
    if (overflowToasted.current === overflowKey) return;
    overflowToasted.current = overflowKey;
    toast(overflowMsg, { ms: 2800 });
  }, [overflowKey, overflowMsg, toast]);

  if (!visible.length) return null;

  return (
    <div className="top-chip-stack" aria-live="polite">
      {visible.map((c) => (
        <div key={c.id} className="top-chip-slot">
          {c.node}
        </div>
      ))}
    </div>
  );
}
