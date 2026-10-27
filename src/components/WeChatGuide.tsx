import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isWeChat,
  WECHAT_GUIDE_EVENT,
  type WeChatGuideRequest,
} from "../lib/wechat.ts";
import { copyText } from "../lib/hema.ts";
import { Sheet } from "./Sheet.tsx";
export function WeChatGuide() {
  const [request, setRequest] = useState<WeChatGuideRequest | null>(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const wechat = isWeChat();
  useEffect(() => {
    if (!wechat) return;
    const onGuide = (event: Event) => {
      const detail = (event as CustomEvent<WeChatGuideRequest>).detail;
      if (!detail || !["hema", "douyin", "general"].includes(detail.app))
        return;
      setMessage("");
      setRequest(detail);
      if (detail.app === "hema" && (detail.term || detail.share)) {
        const params = new URLSearchParams();
        if (detail.term) params.set("hemaTerm", detail.term.slice(0, 300));
        if (detail.share) params.set("hemaShare", detail.share.slice(0, 4000));
        navigate(`/list?${params}`, { replace: true });
      }
    };
    const onNativeClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (!/^(intent:|wdkhema:|snssdk1128:)/i.test(href)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onGuide(
        new CustomEvent(WECHAT_GUIDE_EVENT, {
          detail: {
            app: /wdkhema|hippo/.test(href) ? "hema" : "douyin",
            term: link.dataset.hemaTerm,
          },
        }),
      );
    };
    window.addEventListener(WECHAT_GUIDE_EVENT, onGuide);
    document.addEventListener("click", onNativeClick, true);
    return () => {
      window.removeEventListener(WECHAT_GUIDE_EVENT, onGuide);
      document.removeEventListener("click", onNativeClick, true);
    };
  }, [wechat, navigate]);
  if (!wechat) return null;
  return (
    <>
      <aside className="wechat-notice" aria-label="微信扫码使用提示">
        <span>微信里可以选菜、记账。打开抖音或盒马，请使用手机浏览器。</span>
        <button
          type="button"
          className="linkish"
          onClick={() => setRequest({ app: "general" })}
        >
          查看打开方法
        </button>
      </aside>
      <Sheet
        open={!!request}
        title="请在手机浏览器中打开"
        onClose={() => setRequest(null)}
      >
        <p className="wechat-menu-cue" aria-hidden="true">
          右上角 ··· ↗
        </p>
        <ol>
          <li>点微信页面右上角的“···”。</li>
          <li>选择“在浏览器中打开”。</li>
          <li>
            打开后，再点
            {request?.app === "douyin"
              ? "抖音播放"
              : request?.app === "hema"
                ? "打开盒马"
                : "抖音或盒马按钮"}
            。
          </li>
        </ol>
        {request?.term ? (
          <p>
            这次要买：<strong>{request.term}</strong>
            。已带到当前页面地址，换到浏览器后会显示；在盒马中仍需粘贴搜索。
          </p>
        ) : null}
        <p className="hint">
          看不到该菜单时，可复制链接，粘贴到手机自带浏览器。不同浏览器的本机记录各自保存。
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            void copyText(location.href).then((ok) =>
              setMessage(
                ok
                  ? "链接已复制，请粘贴到手机浏览器"
                  : "复制失败，请长按下方链接手动复制",
              ),
            )
          }
        >
          复制当前页面链接
        </button>
        <p
          className="hint"
          style={{ overflowWrap: "anywhere", userSelect: "all" }}
        >
          {location.href}
        </p>
        <p role="status">{message}</p>
      </Sheet>
    </>
  );
}
