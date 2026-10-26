import type { ReactNode } from "react";
import { dishes } from "../data/catalog.ts";
import { EmptyArt, SplashMark } from "./Art.tsx";

/** If seed catalog failed to hydrate, show themed retry — not a bare crash. */
export function CatalogGate({ children }: { children: ReactNode }) {
  if (dishes.length > 0) return <>{children}</>;

  return (
    <div className="page error-page catalog-fail">
      <div className="empty error-empty load-fail-empty">
        <span className="error-mark" aria-hidden="true">
          <SplashMark className="splash-mark-img error-splash-mark" />
        </span>
        <EmptyArt kind="search" className="empty-art error-empty-art" />
        <strong>菜单还没端上来</strong>
        <p>菜谱数据没读到。点重试再加载；若一直如此，清一下站点缓存后再开。</p>
        <div className="empty-actions">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            重试
          </button>
        </div>
      </div>
    </div>
  );
}
