import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state/store.tsx";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

function focusPrimarySearch(): boolean {
  const candidates = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      '.search input, input[aria-label*="搜"], input[enterkeyhint="search"]',
    ),
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
  const input = candidates[0];
  if (!input) return false;
  input.focus();
  input.select();
  return true;
}

/** ≥880 widescreen: / search, Esc close/clear, g then h/t/u/l/s. Skips while typing. */
export function DeskKeys() {
  const navigate = useNavigate();
  const { themeOpen, mealOpen, closeThemes, closeMeal, rolling, rollCooling } = useApp();
  const chordRef = useRef("");
  const chordTimer = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 880px)").matches) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        if (themeOpen) {
          closeThemes();
          event.preventDefault();
          return;
        }
        if (mealOpen) {
          closeMeal();
          event.preventDefault();
          return;
        }
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement &&
          active.matches('.search input, input[aria-label*="搜"], input[enterkeyhint="search"]')
        ) {
          window.dispatchEvent(new CustomEvent("jte-clear-search"));
          if (!active.value) active.blur();
          event.preventDefault();
          return;
        }
        return;
      }

      if (isEditableTarget(event.target) || rolling || rollCooling) return;

      if (event.key === "/") {
        if (themeOpen || mealOpen) return;
        if (focusPrimarySearch()) event.preventDefault();
        return;
      }

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === "g") {
        chordRef.current = "g";
        if (chordTimer.current) window.clearTimeout(chordTimer.current);
        chordTimer.current = window.setTimeout(() => {
          chordRef.current = "";
        }, 700);
        return;
      }
      if (chordRef.current === "g") {
        const routes: Record<string, string> = {
          h: "/",
          t: "/tonight",
          u: "/us",
          l: "/ledger",
          s: "/list",
        };
        const dest = routes[key];
        if (dest) {
          chordRef.current = "";
          if (chordTimer.current) window.clearTimeout(chordTimer.current);
          event.preventDefault();
          if (themeOpen) closeThemes();
          if (mealOpen) closeMeal();
          navigate(dest);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimer.current) window.clearTimeout(chordTimer.current);
    };
  }, [closeMeal, closeThemes, mealOpen, navigate, rolling, rollCooling, themeOpen]);

  return null;
}
