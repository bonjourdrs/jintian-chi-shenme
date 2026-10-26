import type { ThemeId } from "../types.ts";

export type ThemeCopy = {
  id: ThemeId;
  name: string;
  hint: string;
  color: string;
  eyebrow: string;
  tagline: string;
  search: string;
  featured: string;
  seeAll: string;
  randomTitle: string;
  randomSub: string;
};

export const THEMES: ThemeCopy[] = [
  {
    id: "cafe-journal",
    name: "咖啡馆手账",
    hint: "暖纸钢笔 · 慢品手账气",
    color: "#f4ecdf",
    eyebrow: "",
    tagline: "两个人，好好吃饭",
    search: "搜菜名",
    featured: "翻翻我们的菜单",
    seeAll: "查看全部",
    randomTitle: "随机开饭",
    randomSub: "把今晚交给一点小运气",
  },
  {
    id: "kitchen-chalkboard",
    name: "厨房黑板报",
    hint: "粉笔彩框 · 灶台烟火气",
    color: "#1b4036",
    eyebrow: "",
    tagline: "两个人的烟火气",
    search: "搜菜名",
    featured: "今晚想吃哪一道？",
    seeAll: "全部",
    randomTitle: "今天抽！",
    randomSub: "随机开饭 · 给今晚一点惊喜",
  },
  {
    id: "watercolor-market",
    name: "水彩菜市折页",
    hint: "菜场胶带 · 水色折页感",
    color: "#f4f1e6",
    eyebrow: "",
    tagline: "把菜市场，装进两人餐桌",
    search: "搜菜名",
    featured: "今日新鲜菜单",
    seeAll: "查看全部",
    randomTitle: "随机开饭",
    randomSub: "今晚的惊喜，抽一道就好",
  },
  {
    id: "midnight-magazine",
    name: "午夜食光杂志",
    hint: "夜色金线 · 杂志食光感",
    color: "#14100e",
    eyebrow: "两人食记 · 夜间篇",
    tagline: "灯亮着，晚饭就有着落。",
    search: "搜菜名",
    featured: "今夜菜单",
    seeAll: "全部",
    randomTitle: "随机开饭",
    randomSub: "让今晚，值得期待。",
  },
];

export function themeCopy(id: ThemeId): ThemeCopy {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
