/** Online / offline helpers for PWA cache UX. */

export function isOnline(): boolean {
  try {
    return navigator.onLine !== false;
  } catch {
    return true;
  }
}

/** Toast-friendly message when a network-only action is blocked. */
export const NEED_NET_TOAST = "需要联网才能打开，本机缓存的菜单仍可用";

export function requireOnline(notify: (message: string) => void): boolean {
  if (isOnline()) return true;
  notify(NEED_NET_TOAST);
  return false;
}
