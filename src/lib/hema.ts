import { requireOnline } from "./online.ts";

export const DEFAULT_HEMA_TEMPLATE =
  "https://www.freshippo.com/search?keyword={q}";

export const HEMA_PRESETS: { id: string; name: string; note: string; template: string }[] = [
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
  const stripped = trimmed
    .replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || trimmed;
}

/** Optional native-ish scheme. Many phones ignore it; we always fall back to the web URL. */
export function hemaAppScheme(name: string): string {
  const q = encodeURIComponent(hemaSearchTerm(name) || name.trim());
  const h5 = encodeURIComponent(`https://s.taobao.com/search?q=%E7%9B%92%E9%A9%AC+${q}`);
  return `tbopen://m.taobao.com/tbopen/index.html?action=ali.open.nav&module=h5&bootImage=0&h5Url=${h5}`;
}

export function hemaUrl(name: string, template: string): string {
  const query = encodeURIComponent(hemaSearchTerm(name) || name.trim());
  const base = (template || DEFAULT_HEMA_TEMPLATE).trim() || DEFAULT_HEMA_TEMPLATE;
  if (base.includes("{q}")) return base.replaceAll("{q}", query);
  return base;
}

export function openHema(name: string, template: string, notify: (message: string) => void): void {
  if (!requireOnline(notify)) return;
  const trimmed = name.trim();
  const term = hemaSearchTerm(trimmed);
  if (!term) {
    notify("先写食材名，再在盒马搜");
    return;
  }
  const url = hemaUrl(trimmed, template);

  // Prefer sync open (user gesture) so popup blockers don't eat the tab.
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  // Best-effort App scheme: many browsers quietly ignore unknown protocols.
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = hemaAppScheme(trimmed);
    document.body.append(iframe);
    window.setTimeout(() => iframe.remove(), 800);
  } catch {
    /* ignore */
  }

  const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
  const honest =
    "这是搜索/唤起，不是一键加购。唤不起 App 时，打开盒马粘贴最省事。";
  if (write) {
    void write(term).then(
      () =>
        notify(
          opened
            ? `已复制「${term}」，正在打开盒马搜索。${honest}`
            : `已复制「${term}」。弹窗被拦了，请允许后重试，或打开盒马 App 粘贴搜索。`,
        ),
      () =>
        notify(
          opened
            ? `正在打开「${term}」的搜索页。没复制成功请手动选中食材名。${honest}`
            : "没打开也没复制成，请手动复制食材名，再打开盒马 App 搜索。",
        ),
    );
  } else {
    notify(
      opened
        ? `正在打开「${term}」的搜索页。这个浏览器不能自动复制，请手动选中。${honest}`
        : "请手动复制食材名，打开盒马 App 搜索。",
    );
  }
}

/** Normalize for similarity — strip units/cuts so「番茄丁」「番茄 2个」collapse. */
export function hemaNormalizeKey(term: string): string {
  return term
    .toLowerCase()
    .replace(/[·・.\/\s,_，、]+/g, "")
    .replace(/(适量|少许|若干|一点|少点)/g, "")
    .replace(/(切丝|切片|切丁|切块|切段|剁碎|拍碎|洗净|去皮|去籽|焯水)$/g, "")
    .replace(/(\d+(\.\d+)?)(克|g|千克|kg|毫升|ml|升|l|个|只|根|片|颗|粒|勺|茶匙|汤匙|两)?$/gi, "")
    .replace(/(克|g|千克|kg|毫升|ml|升|l|个|只|根|片|颗|粒|勺|茶匙|汤匙|两)$/gi, "");
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
    if (kept.some((k) => item.key.includes(k.key) && item.key !== k.key)) continue;
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
  const blob = ["盒马搜索关键词（逐条粘贴）", "", ...terms, "", "只是搜索，不是一键加购"].join("\n");
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
