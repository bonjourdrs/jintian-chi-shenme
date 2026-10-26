import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as PtrEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  isOnboardDone,
  markOnboardDone,
  ONBOARD_REPLAY_EVENT,
} from "../lib/onboard.ts";
import { useApp } from "../state/store.tsx";
import { OnboardStepArt } from "./Art.tsx";
import { Sheet } from "./Sheet.tsx";

const STEPS = [
  {
    title: "找今晚吃什么",
    body: "摇一桌随机菜，或按分类慢慢挑。",
    primary: "去摇一桌",
    action: "roll" as const,
    secondary: "逛分类",
    secondaryTo: "/browse",
  },
  {
    title: "挑一套皮肤",
    body: "四套样子，今晚用哪套随你。",
    primary: "选主题",
    action: "theme" as const,
  },
  {
    title: "想吃 · 今晚 · 同步",
    body: "点心收藏，排进今晚，两个人还能同步。",
    primary: "开始用",
    action: "done" as const,
  },
];

export function OnboardSheet() {
  const { openThemes, rollTonight } = useApp();
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? false : !isOnboardDone(),
  );
  const [step, setStep] = useState(0);
  const swipe = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const onReplay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARD_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(ONBOARD_REPLAY_EVENT, onReplay);
  }, []);

  const finish = useCallback(() => {
    markOnboardDone();
    setOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => {
      if (s >= STEPS.length - 1) {
        finish();
        return s;
      }
      return s + 1;
    });
  }, [finish]);

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const onPointerDown = (event: PtrEvent<HTMLDivElement>) => {
    swipe.current = { x: event.clientX, y: event.clientY, active: true };
  };
  const onPointerUp = (event: PtrEvent<HTMLDivElement>) => {
    if (!swipe.current.active) return;
    const dx = event.clientX - swipe.current.x;
    const dy = event.clientY - swipe.current.y;
    swipe.current.active = false;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  if (!open) return null;

  const cur = STEPS[step] ?? STEPS[0];
  const isLast = step >= STEPS.length - 1;

  const onPrimary = () => {
    if (cur.action === "theme") {
      openThemes();
      goNext();
      return;
    }
    if (cur.action === "roll") {
      finish();
      rollTonight();
      return;
    }
    finish();
  };

  return (
    <Sheet open={open} title="三步上手" onClose={finish} compact>
      <div
        className="onboard"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current.active = false;
        }}
      >
        <OnboardStepArt step={step} />
        <div className="onboard-dots" role="tablist" aria-label="引导进度">
          {STEPS.map((_, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`第 ${i + 1} 步，共 ${STEPS.length} 步`}
              className={i === step ? "onboard-dot is-on" : "onboard-dot"}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <p className="onboard-progress" aria-live="polite">
          {step + 1}/{STEPS.length}
        </p>
        <h3 className="onboard-title">{cur.title}</h3>
        <p className="onboard-body">{cur.body}</p>
        <div className="onboard-actions">
          <button
            type="button"
            className="btn-primary onboard-primary"
            onClick={onPrimary}
          >
            {cur.primary}
          </button>
          {"secondary" in cur && cur.secondary && cur.secondaryTo ? (
            <Link
              className="btn-secondary onboard-secondary"
              to={cur.secondaryTo}
              onClick={() => {
                finish();
              }}
            >
              {cur.secondary}
            </Link>
          ) : null}
          {!isLast ? (
            <button
              type="button"
              className="btn-ghost onboard-next"
              onClick={goNext}
            >
              下一步
            </button>
          ) : null}
        </div>
        <div className="onboard-dismiss-row">
          <button
            type="button"
            className="btn-ghost onboard-skip"
            onClick={finish}
          >
            跳过引导
          </button>
          <button
            type="button"
            className="linkish onboard-close"
            onClick={finish}
          >
            关闭
          </button>
        </div>
      </div>
    </Sheet>
  );
}
