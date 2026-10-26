import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  "data-chips"?: string;
};

/** Horizontal chip scroller with edge fades only when more content is off-screen. */
export function ChipsFade({ children, className, "data-chips": dataChips }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const sync = useCallback(() => {
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>(".chips");
    if (!el) {
      setEdges({ left: false, right: false });
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    const overflowing = max > 4;
    const left = overflowing && el.scrollLeft > 4;
    const right = overflowing && el.scrollLeft < max - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(".chips");
    sync();
    el?.addEventListener("scroll", sync, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => sync()) : null;
    if (el) ro?.observe(el);
    ro?.observe(root);
    window.addEventListener("resize", sync);
    const id = window.setTimeout(sync, 80);
    return () => {
      el?.removeEventListener("scroll", sync);
      ro?.disconnect();
      window.removeEventListener("resize", sync);
      window.clearTimeout(id);
    };
  }, [sync, children]);

  return (
    <div
      ref={rootRef}
      className={[
        "chips-fade",
        edges.left || edges.right ? "is-overflowing" : "",
        edges.left ? "can-scroll-left" : "",
        edges.right ? "can-scroll-right" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-chips={dataChips}
    >
      {children}
    </div>
  );
}
