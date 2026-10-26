import { oncePrimary } from "../lib/primaryGuard.ts";
import { categories } from "../data/catalog.ts";
import {
  CATEGORY_IDS,
  MEAL_PRESETS,
  mealSummary,
  mealTotal,
  sameMeal,
} from "../lib/meal.ts";
import type { CategoryId } from "../types.ts";
import { useApp } from "../state/store.tsx";
import { Sheet } from "./Sheet.tsx";

export function MealSheet() {
  const { state, mealOpen, closeMeal, setMeal, rollTonight, rollExclude, setRollExclude, rollLedgerExclude, setRollLedgerExclude, rollLedgerDays, setRollLedgerDays, toast } = useApp();
  const counts = new Map(categories.map((category) => [category.id, category.count]));
  const total = mealTotal(state.meal);
  const menuN = state.menuDishIds.length + state.menuLedgerIds.length;

  const setCount = (id: CategoryId, next: number) => {
    setMeal({ ...state.meal, [id]: Math.max(0, Math.min(4, next)) });
  };

  return (
    <Sheet open={mealOpen} title="几菜几汤" onClose={closeMeal}>
      <p className="hint">点模板一键定几菜几汤，或下面细调。每一类 0–4 道；会跟今晚菜单目标和情侣同步。</p>
      <div className="meal-live-summary" role="status">
        <strong>这一桌 {total} 道</strong>
        <span>{mealSummary(state.meal)}</span>
        {menuN > 0 ? (
          <em>
            今晚已有 {menuN} 道
            {total > 0 && menuN !== total
              ? menuN > total
                ? ` · 比搭配多 ${menuN - total}`
                : ` · 比搭配少 ${total - menuN}`
              : total > 0
                ? " · 刚好"
                : ""}
          </em>
        ) : null}
      </div>
      <div className="presets meal-presets" role="group" aria-label="搭配模板">
        {MEAL_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={sameMeal(state.meal, preset.meal) ? "chip on" : "chip"}
            aria-pressed={sameMeal(state.meal, preset.meal)}
            title={preset.desc}
            onClick={() => {
              setMeal(preset.meal);
              toast(`已套用「${preset.name}」· ${mealTotal(preset.meal)} 道目标`);
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>
      {MEAL_PRESETS.filter((preset) => sameMeal(state.meal, preset.meal)).map((preset) => (
        <p key={preset.id} className="hint">
          {preset.desc}
        </p>
      ))}
      <div className="meal-steppers">
        {CATEGORY_IDS.map((id) => (
          <div key={id} className="step-row">
            <div>
              <strong>{id}</strong>
              <small>库里 {counts.get(id) ?? 0} 道</small>
            </div>
            <div className="stepper">
              <button
                type="button"
                onClick={() => setCount(id, state.meal[id] - 1)}
                disabled={state.meal[id] <= 0}
                aria-label={`少一道${id}`}
              >
                −
              </button>
              <span aria-live="polite">{state.meal[id]}</span>
              <button
                type="button"
                onClick={() => setCount(id, state.meal[id] + 1)}
                disabled={state.meal[id] >= 4}
                aria-label={`多一道${id}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="hint meal-total">
        {total === 0
          ? "先选几道，或点上面的常用搭配。"
          : total > 6
            ? "两个人可能吃不完，周末倒也行。"
            : total < 3
              ? "偏清淡，饿了再加也行。"
              : "看起来刚刚好。"}
      </p>
      <label className="roll-exclude-toggle">
        <input
          type="checkbox"
          checked={rollExclude}
          onChange={(event) => setRollExclude(event.target.checked)}
        />
        <span>避开今晚已有与最近看过的菜（默认开；不够时会放宽）</span>
      </label>
      <label className="roll-exclude-toggle">
        <input
          type="checkbox"
          checked={rollLedgerExclude}
          onChange={(event) => setRollLedgerExclude(event.target.checked)}
        />
        <span>避开账本近几天做过（与今晚/临时排除叠加；池子小时会放宽）</span>
      </label>
      {rollLedgerExclude ? (
        <div className="roll-ledger-days" role="group" aria-label="避开账本天数">
          <span className="hint">窗口</span>
          {([3, 7, 14] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={rollLedgerDays === d ? "chip on" : "chip"}
              aria-pressed={rollLedgerDays === d}
              onClick={() => setRollLedgerDays(d)}
            >
              {d} 天
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="btn-primary block"
        disabled={total <= 0}
        onClick={() => {
          if (!oncePrimary("roll")) return;
          closeMeal();
          rollTonight();
        }}
      >
        按这个摇一桌
      </button>
    </Sheet>
  );
}
