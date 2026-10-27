import { requestWeChatGuide } from "./wechat.ts";
import { splitIngredientLabel } from "./amounts.ts";
import { hemaLaunchHref, isAndroid } from "./nativeLinks.ts";
import { requireOnline } from "./online.ts";

export const DEFAULT_HEMA_TEMPLATE =
  "https://www.freshippo.com/search?keyword={q}";

export const HEMA_PRESETS: {
  id: string;
  name: string;
  note: string;
  template: string;
}[] = [
  {
    id: "freshippo-search",
    name: "盒马官网搜索",
    note: "打开 freshippo.com 搜索页并带上食材名。是否直达结果取决于官网。",
    template: DEFAULT_HEMA_TEMPLATE,
  },
  {
    id: "freshippo-home",
    name: "盒马官网首页",
    note: "只打开首页，食材名仍会复制，方便在 App 里粘贴搜索。",
    template: "https://www.freshippo.com/?keyword={q}",
  },
  {
    id: "hema-app-hint",
    name: "淘宝搜·盒马",
    note: "公开网页搜索「盒马 + 食材」，不是官方加购接口。",
    template: "https://s.taobao.com/search?q=%E7%9B%92%E9%A9%AC+{q}",
  },
  {
    id: "taobao",
    name: "淘宝搜索兜底",
    note: "公开网页搜索，进不了盒马购物车。",
    template: "https://s.taobao.com/search?q={q}",
  },
];

/** Strip bracketed amounts so search is closer to a product keyword. */
export function hemaSearchTerm(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const stripped = splitIngredientLabel(trimmed)
    .base.replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || trimmed;
}

/** Official Hema root scheme; search/cart routes require a verified product integration. */
export function hemaAppScheme(_name: string): string {
  return "wdkhema://main";
}

export function hemaUrl(name: string, template: string): string {
  const query = encodeURIComponent(hemaSearchTerm(name) || name.trim());
  const base =
    (template || DEFAULT_HEMA_TEMPLATE).trim() || DEFAULT_HEMA_TEMPLATE;
  const candidate = base.replaceAll("{q}", query);
  try {
    const url = new URL(candidate);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return candidate;
  } catch {
    /* Invalid imported templates fall back to the public search URL. */
  }
  return DEFAULT_HEMA_TEMPLATE.replaceAll("{q}", query);
}

export function validHemaTemplate(template: string): boolean {
  try {
    const url = new URL(template.replaceAll("{q}", "test"));
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function openHema(
  name: string,
  template: string,
  notify: (message: string) => void,
  navigate = true,
): boolean {
  if (!requireOnline(notify)) return false;
  const trimmed = name.trim();
  const term = hemaSearchTerm(trimmed);
  if (!term) {
    notify("先写食材名，再在盒马搜");
    return false;
  }
  if (requestWeChatGuide({ app: "hema", term })) return false;
  // Start clipboard work without awaiting it, so navigation keeps the user's tap.
  void copyText(term);
  const href = hemaLaunchHref();
  notify(`正在打开盒马，食材：${term}；请在 App 中选商品和数量`);
  if (!navigate) return true;
  if (isAndroid()) window.location.assign(href);
  else window.open(href, "_blank", "noopener,noreferrer");
  // Custom web templates are retained for explicit desktop search preferences only.
  void template;
  return true;
}

/** Normalize for similarity — strip units/cuts so「番茄丁」「番茄 2个」collapse. */
export function hemaNormalizeKey(term: string): string {
  return term
    .toLowerCase()
    .replace(/[·・.\/\s,_，、]+/g, "")
    .replace(/(适量|少许|若干|一点|少点)/g, "")
    .replace(/(切丝|切片|切丁|切块|切段|剁碎|拍碎|洗净|去皮|去籽|焯水)$/g, "")
    .replace(
      /(\d+(\.\d+)?)(克|g|千克|kg|毫升|ml|升|l|个|只|根|片|颗|粒|勺|茶匙|汤匙|两)?$/gi,
      "",
    )
    .replace(
      /(克|g|千克|kg|毫升|ml|升|l|个|只|根|片|颗|粒|勺|茶匙|汤匙|两)$/gi,
      "",
    );
}

/** Deduped search keywords for multi-item Hema flows (honest search only). */
export function hemaKeywords(names: string[]): string[] {
  const candidates: { term: string; key: string }[] = [];
  const exact = new Set<string>();
  for (const name of names) {
    const term = hemaSearchTerm(name);
    if (!term) continue;
    const key = hemaNormalizeKey(term);
    if (!key) continue;
    if (exact.has(key)) continue;
    exact.add(key);
    candidates.push({ term, key });
  }
  /* Drop longer terms that contain a shorter product key (番茄丁 ⊃ 番茄). */
  const kept: { term: string; key: string }[] = [];
  const sorted = [...candidates].sort((a, b) => a.key.length - b.key.length);
  for (const item of sorted) {
    if (kept.some((k) => item.key.includes(k.key) && item.key !== k.key))
      continue;
    kept.push(item);
  }
  /* Preserve first-seen order from original names. */
  const keepKeys = new Set(kept.map((k) => k.key));
  const out: string[] = [];
  const emitted = new Set<string>();
  for (const name of names) {
    const term = hemaSearchTerm(name);
    if (!term) continue;
    const key = hemaNormalizeKey(term);
    if (!keepKeys.has(key) || emitted.has(key)) continue;
    emitted.add(key);
    /* Prefer shortest display term among aliases sharing key */
    const best = kept.find((k) => k.key === key);
    out.push(best?.term ?? term);
  }
  return out;
}

/** Copy unchecked keywords as one-per-line Chinese list for paste into 盒马. */
export async function copyHemaKeywords(
  names: string[],
  notify: (message: string) => void,
): Promise<boolean> {
  const terms = hemaKeywords(names);
  if (terms.length === 0) {
    notify("没有可搜的食材");
    return false;
  }
  const blob = [
    "盒马搜索关键词（逐条粘贴）",
    "",
    ...terms,
    "",
    "只是搜索，不是一键加购",
  ].join("\n");
  const ok = await copyText(blob);
  notify(ok ? `已复制 ${terms.length} 个关键词` : "没能复制，请手动选择");
  return ok;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Honest copy block for export — keywords only, never claims cart/add-to-cart. */
export function hemaSearchAppendix(names: string[]): string {
  const terms = hemaKeywords(names);
  if (terms.length === 0) return "";
  const lines = [
    "盒马可搜：" + terms.join("、"),
    "（仅搜索关键词，请自行在盒马 App / 网页搜索，不是一键加购）",
  ];
  return lines.join(String.fromCharCode(10));
}

/** Share codes are resolved by Hema itself; this app cannot infer a SKU from a token. */
export function openHemaShare(
  share: string,
  notify: (message: string) => void,
  navigate = true,
): void {
  if (!requireOnline(notify)) return;
  const value = share.trim();
  if (!value || value.length > 4000) {
    notify("请粘贴有效的盒马商品口令或链接");
    return;
  }
  if (requestWeChatGuide({ app: "hema", share: value })) return;
  void copyText(value);
  notify("正在打开盒马，请在 App 中确认分享商品；尚未加购");
  if (!navigate) return;
  if (isAndroid()) window.location.assign(hemaLaunchHref());
  else window.open(hemaLaunchHref(), "_blank", "noopener,noreferrer");
}
