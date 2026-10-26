/** Android Chrome requires App navigation to happen directly in the tap handler. */
export function isAndroid(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
): boolean {
  return /Android/i.test(ua);
}
export function androidIntent(
  schemeUrl: string,
  fallback: string,
  packageName?: string,
): string {
  const match = /^(wdkhema|snssdk1128):\/\/([^#]*)$/.exec(schemeUrl);
  const web = new URL(fallback);
  if (
    !match ||
    web.protocol !== "https:" ||
    web.username ||
    web.password ||
    (packageName && !/^[a-zA-Z0-9_.]+$/.test(packageName))
  )
    throw new Error("Invalid App link");
  return `intent://${match[2]}#Intent;scheme=${match[1]};${packageName ? `package=${packageName};` : ""}S.browser_fallback_url=${encodeURIComponent(web.href)};end`;
}
export function douyinVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !["www.douyin.com", "www.iesdouyin.com", "www.douyin.com.cn"].includes(
        parsed.hostname,
      )
    )
      return null;
    return (
      /^\/(?:share\/)?video\/(\d{10,25})\/?$/.exec(parsed.pathname)?.[1] ?? null
    );
  } catch {
    return null;
  }
}
export function preferredNativeMode(app: "douyin" | "hema"): "scheme" | "intent" | "official" {
  try { const mode = localStorage.getItem(`jte.native.${app}`); if (mode === "intent" || mode === "official") return mode; } catch { /* Defaults still work without storage. */ }
  return "scheme";
}
export function douyinPlaybackHref(url: string, ua?: string): string {
  const id = douyinVideoId(url);
  if (!id || !isAndroid(ua)) return url;
  const scheme = `snssdk1128://aweme/detail/${id}?refer=web&needlaunchlog=1`;
  const official = `https://www.iesdouyin.com/share/video/${id}/`;
  const mode = preferredNativeMode("douyin");
  return mode === "intent" ? androidIntent(scheme, official) : mode === "official" ? official : scheme;
}
export const HEMA_APP_PAGE = "https://www.freshippo.com/down/app.html";
export function hemaLaunchHref(ua?: string): string {
  if (!isAndroid(ua)) return HEMA_APP_PAGE;
  const mode = preferredNativeMode("hema");
  return mode === "intent" ? androidIntent("wdkhema://main", HEMA_APP_PAGE, "com.wudaokou.hippo") : mode === "official" ? HEMA_APP_PAGE : "wdkhema://main";
}
