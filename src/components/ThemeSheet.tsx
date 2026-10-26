import { useEffect } from "react";
import { THEMES } from "../theme/themes.ts";
import { themeTexture } from "../lib/assets.ts";
import { useApp } from "../state/store.tsx";
import { Sheet } from "./Sheet.tsx";

export function ThemeButton() {
  const { openThemes } = useApp();
  return (
    <button type="button" className="theme-btn" onClick={openThemes} aria-label="切换四套皮肤">
      <span className="swatches" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

export function ThemeSheet() {
  const { state, themeOpen, closeThemes, setTheme } = useApp();

  useEffect(() => {
    if (!themeOpen) return;
    for (const theme of THEMES) {
      const img = new Image();
      img.src = themeTexture(theme.id);
    }
  }, [themeOpen]);

  return (
    <Sheet open={themeOpen} title="选一套今晚的皮肤" onClose={closeThemes}>
      <p className="hint">四套样子会记在这台设备上。切换时纸色与纹理会交叉淡入，尽量不闪一下旧色。</p>
      <div className="preview-grid-scroller" data-theme-scroll="">
        <div className="preview-grid">
        {THEMES.map((theme) => {
          const on = state.theme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              className={`theme-preview preview-${theme.id}${on ? " is-current" : ""}`}
              aria-pressed={on}
              onClick={() => {
                setTheme(theme.id);
                closeThemes();
              }}
            >
              <span
                className={`preview-stage stage-${theme.id} has-texture`}
                style={{ backgroundImage: `url("${themeTexture(theme.id)}")` }}
              >
                <span className="preview-stage-veil" aria-hidden="true" />
                <span className="ps-title">今天吃什么</span>
                <span className="ps-row">
                  <i />
                  <i />
                </span>
                <span className="ps-pill" />
              </span>
              <span className="preview-meta">
                <span className="preview-name">{theme.name}</span>
                <span className="preview-tag">{theme.hint}</span>
              </span>
              {on ? (
                <span className="preview-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
              <span className="sr-only">{on ? "当前使用" : ""}</span>
            </button>
          );
        })}
        </div>
      </div>
    </Sheet>
  );
}
