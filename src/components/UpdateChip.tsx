import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Non-blocking chip when a new service worker is waiting.
 * Tap → SKIP_WAITING + reload once. Never auto-loops.
 */
export function UpdateChip() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [busy, setBusy] = useState(false);
  const reloadArmed = useRef(false);

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
        /* First install — activate without prompting. */
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

  const apply = () => {
    if (!waiting || busy) return;
    setBusy(true);
    reloadArmed.current = true;
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      reloadArmed.current = false;
      setBusy(false);
      window.location.reload();
      return;
    }
    window.setTimeout(() => {
      if (!reloadArmed.current) return;
      reloadArmed.current = false;
      window.location.reload();
    }, 1200);
  };

  if (!waiting) return null;

  return (
    <button
      type="button"
      className="update-chip"
      onClick={apply}
      disabled={busy}
      aria-live="polite"
    >
      <span className="update-chip-dot" aria-hidden="true" />
      <span>{busy ? "正在更新…" : "有新版本 · 刷新"}</span>
    </button>
  );
}
