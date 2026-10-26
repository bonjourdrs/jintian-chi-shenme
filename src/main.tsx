import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./styles/global.css";
import "./styles/themes.css";
import "./styles/redesign.css";
import "./styles/overlays.css";
import { applyDensity, loadDensity } from "./lib/density.ts";
import { applyGridCols, loadGridCols } from "./lib/gridCols.ts";
import { applyGridGap, loadGridGap } from "./lib/gridGap.ts";
import { preloadThemeTextures } from "./lib/themeTextures.ts";

applyDensity(loadDensity());
applyGridCols(loadGridCols());
applyGridGap(loadGridGap());
preloadThemeTextures();

const root = document.getElementById("root");
if (!root) throw new Error("缺少根节点");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

/** Prefer closing splash after first themed paint (home skeleton), not on blank #root. */
function closeBootSplash() {
  const close = (window as unknown as { __jteCloseBoot?: () => void }).__jteCloseBoot;
  close?.();
}
function armBootClose() {
  let closed = false;
  const once = () => {
    if (closed) return;
    closed = true;
    closeBootSplash();
  };
  window.addEventListener("jte-app-painted", once, { once: true });
  window.addEventListener("jte-shell-ready", once, { once: true });
  /* Fallback if not on home: shell fires ready; still hard-cap below. */
  window.setTimeout(once, 420);
}
armBootClose();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
