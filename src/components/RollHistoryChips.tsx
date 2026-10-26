import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearRollHistory,
  flattenRollChips,
  loadRollHistory,
  type RollDish,
} from "../lib/rollHistory.ts";
import { hapticTap } from "../lib/haptics.ts";

type Props = {
  toast?: (msg: string) => void;
  className?: string;
};

export function RollHistoryChips({ toast, className }: Props) {
  const [chips, setChips] = useState<RollDish[]>(() => flattenRollChips());
  const [hasSnaps, setHasSnaps] = useState(() => loadRollHistory().length > 0);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setChips(flattenRollChips());
      setHasSnaps(loadRollHistory().length > 0);
    };
    refresh();
    window.addEventListener("jte-roll-history", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("jte-roll-history", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!hasSnaps || chips.length === 0) return null;

  return (
    <section
      className={["roll-history", className].filter(Boolean).join(" ")}
      aria-label="最近摇到"
    >
      <div className="section-head roll-history-head">
        <h2>最近摇到</h2>
        <button
          type="button"
          className="see-all roll-history-clear"
          onClick={() => setConfirmClear(true)}
        >
          清空历史
        </button>
      </div>
      <div className="roll-history-chips" role="list">
        {chips.map((dish) => (
          <Link
            key={dish.id}
            role="listitem"
            className="roll-chip"
            to={`/d/${encodeURIComponent(dish.id)}`}
            title={dish.name}
          >
            {dish.name}
          </Link>
        ))}
      </div>
      {confirmClear ? (
        <div
          className="clear-confirm-overlay roll-clear-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roll-clear-title"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="clear-confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="roll-clear-title">清空随机历史？</h2>
            <p className="hint">只清本机「最近摇到」记录，今晚菜单和想吃不受影响。</p>
            <div className="row-btns wrap">
              <button type="button" className="btn-ghost" onClick={() => setConfirmClear(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  clearRollHistory();
                  setChips([]);
                  setHasSnaps(false);
                  setConfirmClear(false);
                  toast?.("已清空随机历史");
                  hapticTap();
                }}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
