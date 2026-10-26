import { useEffect, useRef, useState } from "react";
import { isOnline } from "../lib/online.ts";
import { loadRoomMeta } from "../lib/coupleSync.ts";
import { useApp } from "../state/store.tsx";

/** Small non-blocking chip when offline; toast once on reconnect + nudge paired sync. */
export function OfflineChip() {
  const { toast } = useApp();
  const [offline, setOffline] = useState(() => (typeof navigator === "undefined" ? false : !isOnline()));
  const [dismissed, setDismissed] = useState(false);
  const wasOffline = useRef(offline);
  const reconnectToastAt = useRef(0);

  useEffect(() => {
    const sync = () => {
      const next = !isOnline();
      const prev = wasOffline.current;
      wasOffline.current = next;
      setOffline(next);
      if (prev && !next) {
        setDismissed(false);
        const now = Date.now();
        /* No spam: at most once per 8s */
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

  if (!offline || dismissed) return null;

  return (
    <div className="offline-chip is-dismissible" role="status" aria-live="polite">
      <span className="offline-chip-dot" aria-hidden="true" />
      <span>离线可用</span>
      <em>菜单·今晚·想吃·账本仍可看</em>
      <button
        type="button"
        className="offline-chip-dismiss"
        aria-label="收起离线提示"
        title="本会话内不再显示"
        onClick={() => setDismissed(true)}
      >
        收起
      </button>
    </div>
  );
}
