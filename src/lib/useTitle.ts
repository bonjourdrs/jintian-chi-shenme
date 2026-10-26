import { useEffect } from "react";

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · 今天吃什么` : "今天吃什么";
  }, [title]);
}
