import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icons.tsx";
import { createPortal } from "react-dom";

let openSheets = 0;
let savedOverflow = "";
const sheetStack: HTMLElement[] = [];

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function listFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  compact = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const root = panel.current;
    if (!root) return;
    const prev = document.activeElement as HTMLElement | null;
    sheetStack.push(root);
    if (openSheets++ === 0) savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const app = document.getElementById("root");
    if (app) app.inert = true;
    const items = listFocusable(root);
    (items[0] ?? root).focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (sheetStack.at(-1) !== root) return;
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = listFocusable(root);
      if (focusables.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const index = sheetStack.indexOf(root);
      if (index >= 0) sheetStack.splice(index, 1);
      openSheets = Math.max(0, openSheets - 1);
      if (app) app.inert = openSheets > 0;
      if (openSheets === 0) document.body.style.overflow = savedOverflow;
      const parent = sheetStack.at(-1);
      if (parent)
        (prev?.isConnected && parent.contains(prev)
          ? prev
          : (listFocusable(parent)[0] ?? parent)
        ).focus({ preventScroll: true });
      else prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-root modal-layer">
      <button
        type="button"
        className="backdrop modal-backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        className={
          compact ? "sheet modal-panel is-compact" : "sheet modal-panel"
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
