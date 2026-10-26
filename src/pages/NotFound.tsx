import { Link, useNavigate } from "react-router-dom";
import { EmptyArt, SplashMark } from "../components/Art.tsx";
import { useTitle } from "../lib/useTitle.ts";

type Props = {
  title?: string;
  hint?: string;
};

export function NotFound({ title = "这页被吃掉了", hint = "回到菜单，重新挑一道。" }: Props) {
  useTitle(title === "这页被吃掉了" ? "走丢了" : title);
  const navigate = useNavigate();
  return (
    <div className="page error-page">
      <div className="empty error-empty">
        <span className="error-mark" aria-hidden="true">
          <SplashMark className="splash-mark-img error-splash-mark" />
        </span>
        <EmptyArt kind="search" className="empty-art error-empty-art" />
        <strong>{title}</strong>
        <p>{hint}</p>
        <div className="empty-actions">
          <Link className="btn-primary" to="/">
            回首页
          </Link>
          <Link className="btn-secondary" to="/browse">
            去翻菜单
          </Link>
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            返回
          </button>
        </div>
      </div>
    </div>
  );
}
