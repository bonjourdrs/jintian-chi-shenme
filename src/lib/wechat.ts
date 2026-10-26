export type WeChatGuideRequest = {
  app: "hema" | "douyin" | "general";
  term?: string;
  share?: string;
};
export const WECHAT_GUIDE_EVENT = "jte-wechat-open-guide";
export function isWeChat(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
): boolean {
  return /MicroMessenger/i.test(ua);
}
export function requestWeChatGuide(detail: WeChatGuideRequest): boolean {
  if (!isWeChat()) return false;
  window.dispatchEvent(new CustomEvent(WECHAT_GUIDE_EVENT, { detail }));
  return true;
}
