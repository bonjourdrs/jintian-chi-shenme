import { copyText } from "./hema.ts";
import { loadDisplayNick, sanitizeNick } from "./nicks.ts";

export const APP_URL = "https://jintian-chi-shenme.deed.page/";

export async function shareOrCopy(
  payload: { title: string; text: string; url?: string },
  notify: (message: string) => void,
): Promise<void> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const blob = payload.url ? `${payload.text}\n${payload.url}` : payload.text;
  const ok = await copyText(blob);
  notify(ok ? "已复制，可以粘贴分享" : "分享不可用，请手动复制");
}

function resolveNick(nick?: string): string {
  return sanitizeNick(nick || loadDisplayNick() || "");
}

export function buildDishShareText(input: {
  name: string;
  minutes?: number;
  tags?: string[];
  ingredients: string[];
  refined?: boolean;
  nick?: string;
}): { title: string; text: string; url: string } {
  const nick = resolveNick(input.nick);
  const bits: string[] = [];
  if (nick) bits.push(`${nick} 今晚想做「${input.name}」`);
  else bits.push(`今晚想做「${input.name}」`);
  if (input.refined) bits.push("（家里试过的精修菜谱）");
  const meta: string[] = [];
  if (input.minutes) meta.push(`大约 ${input.minutes} 分钟`);
  if (input.tags && input.tags.length) meta.push(input.tags.slice(0, 3).join(" · "));
  if (meta.length) bits.push(meta.join(" · "));
  if (input.ingredients.length > 0) {
    bits.push("", "大概要用这些：");
    bits.push(...input.ingredients.slice(0, 8).map((line) => `· ${line}`));
    if (input.ingredients.length > 8) bits.push("· …");
  }
  bits.push("", "打开「今天吃什么」一起看看吧", APP_URL);
  bits.push("（盒马请自行搜索，不是一键加购）");
  return {
    title: `${input.name} · 今天吃什么`,
    text: bits.join("\n"),
    url: APP_URL,
  };
}

export function buildTonightShareText(input: {
  mealLabel: string;
  dishes: string[];
  ingredients: string[];
  note?: string;
  nick?: string;
}): { title: string; text: string; url: string } {
  const nick = resolveNick(input.nick);
  const bits: string[] = [];
  if (nick) bits.push(`${nick} 定好了今晚菜单`);
  else bits.push("今晚菜单定好啦");
  if (input.mealLabel && input.mealLabel !== "还没选") {
    bits.push(`搭配：${input.mealLabel}`);
  }
  const note = (input.note || "").trim();
  if (note) {
    bits.push(`备忘：${note}`);
  }
  if (input.dishes.length) {
    bits.push("", "【今晚吃】");
    bits.push(...input.dishes.map((name, i) => `${i + 1}. ${name}`));
  }
  if (input.ingredients.length) {
    bits.push("", "【食材速览】");
    bits.push(...input.ingredients.slice(0, 12).map((line) => `· ${line}`));
    if (input.ingredients.length > 12) bits.push("· …");
  }
  bits.push("", "打开「今天吃什么」一起看看吧", APP_URL);
  bits.push("（盒马请自行搜索，不是一键加购）");
  return {
    title: "今晚菜单 · 今天吃什么",
    text: bits.join("\n"),
    url: APP_URL,
  };
}
