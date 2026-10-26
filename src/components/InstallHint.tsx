import { useEffect, useState } from "react";

const DISMISS_KEY = "jte-pwa-tip-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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

function isIosSafari(): boolean {
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const crios = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !crios;
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return true;
  }
}

/** Subtle dismissible add-to-home-screen hint — mobile only, no nag after dismiss. */
export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [ownedByTop, setOwnedByTop] = useState(false);

  useEffect(() => {
    const onOwned = (event: Event) => {
      const owned = Boolean((event as CustomEvent<{ owned?: boolean }>).detail?.owned);
      setOwnedByTop(owned);
    };
    window.addEventListener("jte-topchips-install", onOwned as EventListener);
    return () => window.removeEventListener("jte-topchips-install", onOwned as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || wasDismissed()) return;

    const narrow = window.matchMedia("(max-width: 879px)").matches;
    if (!narrow) return;

    if (isIosSafari()) {
      setIos(true);
      setVisible(true);
    }

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user dismissed native sheet */
    }
    setDeferred(null);
    dismiss();
  };

  if (!visible || ownedByTop) return null;

  return (
    <aside className="install-tip install-hint" role="status">
      <p>
        {ios
          ? "想固定到主屏幕：点底部分享，再选「添加到主屏幕」。"
          : deferred
            ? "可以把「今天吃什么」装到主屏幕，下次像 App 一样打开。"
            : "想固定到主屏幕：用浏览器菜单里的「安装应用」或「添加到主屏幕」。"}
      </p>
      <div className="install-hint-actions">
        {deferred ? (
          <button type="button" className="btn-secondary compact" onClick={() => void install()}>
            安装
          </button>
        ) : null}
        <button type="button" className="linkish" onClick={dismiss}>
          知道了
        </button>
      </div>
    </aside>
  );
}
