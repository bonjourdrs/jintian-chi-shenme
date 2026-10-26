import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyArt, SplashMark } from "./Art.tsx";
import { APP_VERSION, SW_CACHE } from "../lib/version.ts";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  private retry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  private goHome = () => {
    this.setState({ error: null });
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error.message?.trim();
      return (
        <div className="crash page error-page">
          <div className="empty error-empty load-fail-empty">
            <span className="error-mark" aria-hidden="true">
              <SplashMark className="splash-mark-img error-splash-mark" />
            </span>
            <EmptyArt kind="tonight" className="empty-art error-empty-art" />
            <strong>菜单打翻了</strong>
            <p>加载出了点岔子。点重试再摆一回；本机缓存的数据一般还在。</p>
            {msg ? (
              <p className="error-detail hint" role="status">
                {msg.length > 120 ? `${msg.slice(0, 118)}…` : msg}
              </p>
            ) : null}
            <div className="empty-actions">
              <button type="button" className="btn-primary" onClick={this.retry}>
                重试
              </button>
              <button type="button" className="btn-ghost" onClick={this.goHome}>
                回首页
              </button>
            </div>
            <p className="error-version hint">
              版本 {APP_VERSION} · SW {SW_CACHE}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
