import type { Dish, Ingredient, Method } from "../types.ts";
import overrides from "./recipeOverrides.json" with { type: "json" };

const SEASONING = new Set([
  "大蒜",
  "姜",
  "小葱",
  "孜然",
  "咖喱",
  "黑胡椒",
  "蜂蜜",
  "蚝油",
  "豆瓣酱",
  "花椒",
  "干辣椒",
  "白糖",
  "香醋",
  "香油",
  "黄油",
  "芥末",
  "豆豉",
  "沙茶酱",
  "酸梅酱",
  "照烧汁",
  "奥尔良腌料",
  "淀粉",
  "料酒",
  "生抽",
  "老抽",
  "食用油",
  "盐",
  "清水",
  "白醋",
  "辣椒油",
  "冰糖",
  "酸汤调料",
  "橙子",
]);

const LEXICON: [string, string][] = [
  ["鸡毛菜", "鸡毛菜"],
  ["油麦菜", "油麦菜"],
  ["空心菜", "空心菜"],
  ["上海青", "上海青"],
  ["娃娃菜", "娃娃菜"],
  ["大白菜", "大白菜"],
  ["小白菜", "小白菜"],
  ["小青菜", "小青菜"],
  ["黄心菜", "黄心菜"],
  ["红菜苔", "红菜苔"],
  ["白菜苔", "白菜苔"],
  ["菜苔", "菜苔"],
  ["菜心", "菜心"],
  ["红苋菜", "红苋菜"],
  ["白苋菜", "白苋菜"],
  ["苋菜", "苋菜"],
  ["菠菜", "菠菜"],
  ["生菜", "生菜"],
  ["包菜", "包菜"],
  ["卷心菜", "包菜"],
  ["花椰菜", "花菜"],
  ["西兰花", "西兰花"],
  ["花菜", "花菜"],
  ["西葫芦", "西葫芦"],
  ["黄瓜", "黄瓜"],
  ["冬瓜", "冬瓜"],
  ["南瓜", "南瓜"],
  ["丝瓜", "丝瓜"],
  ["苦瓜", "苦瓜"],
  ["茄子", "茄子"],
  ["茄盒", "茄子"],
  ["土豆片", "土豆"],
  ["土豆丝", "土豆"],
  ["土豆条", "土豆"],
  ["土豆泥", "土豆"],
  ["小土豆", "土豆"],
  ["土豆", "土豆"],
  ["红薯叶", "红薯叶"],
  ["红薯杆", "红薯杆"],
  ["红薯", "红薯"],
  ["芋头", "芋头"],
  ["山药", "山药"],
  ["藕带", "藕带"],
  ["藕丝", "莲藕"],
  ["莲藕", "莲藕"],
  ["胡萝卜", "胡萝卜"],
  ["白萝卜", "白萝卜"],
  ["萝卜", "萝卜"],
  ["洋葱", "洋葱"],
  ["青椒", "青椒"],
  ["尖椒", "尖椒"],
  ["彩椒", "彩椒"],
  ["红椒", "红椒"],
  ["小米辣", "小米辣"],
  ["干辣椒", "干辣椒"],
  ["泡椒", "泡椒"],
  ["擂辣椒", "辣椒"],
  ["鲊辣椒", "鲊辣椒"],
  ["鲊胡椒", "鲊辣椒"],
  ["烧椒", "青椒"],
  ["辣椒", "辣椒"],
  ["蒜苔", "蒜苔"],
  ["蒜薹", "蒜苔"],
  ["蒜苗", "蒜苗"],
  ["小葱", "小葱"],
  ["韭菜", "韭菜"],
  ["韭黄", "韭黄"],
  ["黄豆芽", "黄豆芽"],
  ["绿豆芽", "绿豆芽"],
  ["豆芽", "豆芽"],
  ["荷兰豆", "荷兰豆"],
  ["豌豆", "豌豆"],
  ["毛豆", "毛豆"],
  ["蚕豆", "蚕豆"],
  ["四季豆", "四季豆"],
  ["豆角", "豆角"],
  ["芦笋", "芦笋"],
  ["春笋", "春笋"],
  ["竹笋", "竹笋"],
  ["莴苣丝", "莴笋"],
  ["莴笋", "莴笋"],
  ["莴苣", "莴笋"],
  ["金针菇", "金针菇"],
  ["杏鲍菇", "杏鲍菇"],
  ["鹿茸菇", "鹿茸菇"],
  ["口蘑", "口蘑"],
  ["平菇", "平菇"],
  ["香菇", "香菇"],
  ["菌菇", "菌菇"],
  ["木耳", "木耳"],
  ["海带", "海带"],
  ["紫菜", "紫菜"],
  ["油豆腐", "油豆腐"],
  ["香干", "香干"],
  ["豆干", "豆干"],
  ["腐竹", "腐竹"],
  ["千张", "千张"],
  ["豆皮", "豆皮"],
  ["豆腐丝", "豆腐丝"],
  ["豆腐", "豆腐"],
  ["面筋", "面筋"],
  ["粉丝", "粉丝"],
  ["粉条", "粉条"],
  ["凉粉", "凉粉"],
  ["年糕", "年糕"],
  ["汤圆", "汤圆"],
  ["饺子", "饺子"],
  ["火鸡面", "火鸡面"],
  ["泡面", "方便面"],
  ["方便面", "方便面"],
  ["藜蒿", "藜蒿"],
  ["苕尖", "苕尖"],
  ["外婆菜", "外婆菜"],
  ["酸菜", "酸菜"],
  ["榨菜", "榨菜"],
  ["小番茄", "小番茄"],
  ["青番茄", "番茄"],
  ["西红柿", "番茄"],
  ["番茄", "番茄"],
  ["柿子", "柿子"],
  ["苹果", "苹果"],
  ["菠萝", "菠萝"],
  ["凤梨", "菠萝"],
  ["芒果", "芒果"],
  ["青柠", "青柠"],
  ["柠檬", "柠檬"],
  ["百香果", "百香果"],
  ["山楂", "山楂"],
  ["板栗", "板栗"],
  ["花生", "花生"],
  ["芝麻", "芝麻"],
  ["玉米", "玉米"],
  ["棉花糖", "棉花糖"],
  ["话梅", "话梅"],
  ["芝士", "芝士"],
  ["牛奶", "牛奶"],
  ["黄油", "黄油"],
  ["可乐", "可乐"],
  ["基围虾", "基围虾"],
  ["罗氏虾", "罗氏虾"],
  ["黑虎虾", "黑虎虾"],
  ["小龙虾", "小龙虾"],
  ["虾仁", "虾仁"],
  ["虾滑", "虾滑"],
  ["虾尾", "虾"],
  ["虾球", "虾仁"],
  ["花甲", "花甲"],
  ["梭子蟹", "梭子蟹"],
  ["蟹柳", "蟹柳"],
  ["螃蟹", "螃蟹"],
  ["鲍鱼", "鲍鱼"],
  ["鱿鱼", "鱿鱼"],
  ["鳝鱼", "鳝鱼"],
  ["鲈鱼", "鲈鱼"],
  ["鲫鱼", "鲫鱼"],
  ["武昌鱼", "武昌鱼"],
  ["鱼糕", "鱼糕"],
  ["鱼丸", "鱼丸"],
  ["鱼片", "鱼片"],
  ["小海鲜", "海鲜"],
  ["肥牛", "肥牛"],
  ["牛腩", "牛腩"],
  ["牛肚", "牛肚"],
  ["牛肋条", "牛肋条"],
  ["牛腱子", "牛腱"],
  ["牛腱", "牛腱"],
  ["黄牛肉", "牛肉"],
  ["碎牛肉", "牛肉"],
  ["牛肉", "牛肉"],
  ["五花肉", "五花肉"],
  ["小炒肉", "猪肉"],
  ["滑肉", "猪肉"],
  ["咕肉", "猪里脊"],
  ["鸡腿肉", "鸡腿"],
  ["鸡胸肉", "鸡胸肉"],
  ["鸡肉", "鸡肉"],
  ["鸭肉", "鸭"],
  ["猪肉", "猪肉"],
  ["排骨", "排骨"],
  ["肋排", "肋排"],
  ["猪排", "猪排"],
  ["猪肝", "猪肝"],
  ["猪肚", "猪肚"],
  ["猪耳朵", "猪耳"],
  ["猪耳", "猪耳"],
  ["猪头肉", "猪头肉"],
  ["肥肠", "肥肠"],
  ["里脊", "猪里脊"],
  ["叉烧", "叉烧"],
  ["腊肉", "腊肉"],
  ["腊肠", "腊肠"],
  ["香肠", "香肠"],
  ["火腿肠", "火腿肠"],
  ["火腿", "火腿"],
  ["培根", "培根"],
  ["肉末", "猪肉末"],
  ["肉丝", "猪肉丝"],
  ["肉片", "猪肉片"],
  ["珍珠圆子", "猪肉末"],
  ["圆子", "猪肉丸"],
  ["肉圆", "猪肉丸"],
  ["肉丸", "猪肉丸"],
  ["丸子", "猪肉丸"],
  ["小酥肉", "猪肉"],
  ["鸡翅", "鸡翅"],
  ["鸡腿", "鸡腿"],
  ["鸡胸", "鸡胸肉"],
  ["鸡爪", "鸡爪"],
  ["凤爪", "鸡爪"],
  ["鸡胗", "鸡胗"],
  ["鸡排", "鸡胸肉"],
  ["鸭胗", "鸭胗"],
  ["鹌鹑蛋", "鹌鹑蛋"],
  ["咸蛋黄", "咸蛋黄"],
  ["皮蛋", "皮蛋"],
  ["荷包蛋", "鸡蛋"],
  ["金钱蛋", "鸡蛋"],
  ["鸡蛋", "鸡蛋"],
  ["蛋黄", "鸡蛋"],
  ["蜂子", "蜂子"],
  ["薯片", "薯片"],
  ["薯角", "土豆"],
  ["筒子骨", "筒子骨"],
  ["蒸肉粉", "蒸肉粉"],
  ["糯米", "糯米"],
  ["白菜", "白菜"],
  ["锅巴", "锅巴"],
  ["青菜", "青菜"],
  ["仔姜", "姜"],
  ["面粉", "面粉"],
  ["藕", "莲藕"],
  ["笋", "笋"],
  ["虾", "虾"],
  ["蟹", "螃蟹"],
  ["鱼", "鱼"],
  ["鸡", "鸡肉"],
  ["鸭", "鸭"],
  ["蛋", "鸡蛋"],
  ["肉", "猪肉"],
  ["烩饭", "米饭"],
  ["焖饭", "米饭"],
  ["煲仔", "米饭"],
  ["卤味", "卤味"],
  ["卤菜", "卤味"],
  ["时蔬", "时蔬"],
  ["青豆", "青豆"],
  ["松仁", "松仁"],
  ["番茄酱", "番茄酱"],
  ["辣椒粉", "辣椒粉"],
  ["蜂蜜", "蜂蜜"],
  ["芥末", "芥末"],
  ["面", "面条"],
  ["葱", "小葱"],
  ["姜", "姜"],
  ["蒜", "大蒜"],
];

const FLAVORS: [string, string[]][] = [
  ["鱼香", ["泡椒", "木耳"]],
  ["糖醋", ["白糖", "香醋"]],
  ["蒜蓉", ["大蒜"]],
  ["蒜泥", ["大蒜"]],
  ["蒜香", ["大蒜"]],
  ["葱油", ["小葱", "香油"]],
  ["葱香", ["小葱"]],
  ["黑椒", ["黑胡椒"]],
  ["孜然", ["孜然"]],
  ["辣子", ["干辣椒"]],
  ["咖喱", ["咖喱"]],
  ["沙茶", ["沙茶酱"]],
  ["麻辣", ["干辣椒", "花椒"]],
  ["香辣", ["干辣椒"]],
  ["酸辣", ["香醋", "干辣椒"]],
  ["酸汤", ["酸汤调料"]],
  ["蜜汁", ["蜂蜜"]],
  ["蚝油", ["蚝油"]],
  ["豆豉", ["豆豉"]],
  ["芥末", ["芥末"]],
  ["黄油", ["黄油"]],
  ["梅酱", ["酸梅酱"]],
  ["照烧", ["照烧汁"]],
  ["奥尔良", ["奥尔良腌料"]],
  ["宫保", ["花生", "干辣椒"]],
  ["豆瓣", ["豆瓣酱"]],
  ["橙香", ["橙子"]],
  ["回锅", ["豆瓣酱"]],
  ["双椒", ["青椒", "红椒"]],
  ["醋溜", ["香醋"]],
  ["锅包", ["白糖", "香醋"]],
];

const SPECIAL: Record<string, { items: string[]; guess?: boolean }> = {
  蚂蚁上树: { items: ["粉丝", "猪肉末", "豆瓣酱"] },
  红三剁: { items: ["猪肉末", "番茄", "辣椒"] },
  珍珠圆子: { items: ["猪肉末", "糯米"] },
  菜煎饼: { items: ["面粉", "鸡蛋", "青菜"] },
  三鲜汤: { items: ["虾仁", "豆腐", "火腿"], guess: true },
  凉拌二丝: { items: ["黄瓜", "胡萝卜"] },
  凉拌三丝: { items: ["黄瓜", "豆腐丝", "粉丝"] },
  糖醋茄盒: { items: ["茄子", "猪肉末", "白糖", "香醋"] },
  锅包肉: { items: ["猪里脊", "白糖", "香醋"] },
  水煮肉片: { items: ["猪里脊", "豆芽", "白菜", "干辣椒", "花椒"] },
  口水鸡: { items: ["鸡肉", "花生", "辣椒油"] },
  金钱蛋: { items: ["鸡蛋", "五花肉"] },
  肠包蛋: { items: ["香肠", "鸡蛋"] },
  麻婆豆腐: { items: ["豆腐", "牛肉末", "豆瓣酱", "花椒"] },
  徐福烩饭: { items: ["米饭", "虾仁", "鸡蛋", "玉米", "青豆"], guess: true },
  电饭煲焖饭: { items: ["米饭", "腊肠", "鸡蛋"], guess: true },
  懒人焖饭: { items: ["米饭", "鸡蛋", "青菜"], guess: true },
  煲仔饭: { items: ["米饭", "腊肠", "鸡蛋"] },
  农家一碗香: { items: ["猪肉", "青菜", "米饭"], guess: true },
  热卤合炒: { items: ["卤味", "青椒", "大蒜"], guess: true },
  烩卤菜: { items: ["卤味", "豆芽"], guess: true },
  蒸菜: { items: ["时蔬", "猪肉"], guess: true },
  金玉满堂: { items: ["玉米", "虾仁", "松仁"], guess: true },
  地三鲜: { items: ["土豆", "茄子", "青椒"] },
  鱼香肉丝: { items: ["猪肉丝", "木耳", "胡萝卜", "泡椒"] },
  宫保鸡丁: { items: ["鸡肉", "花生", "干辣椒"] },
  回锅肉: { items: ["五花肉", "青椒", "豆瓣酱"] },
  酸菜鱼: { items: ["鱼片", "酸菜", "干辣椒"] },
  番茄鸡蛋汤: { items: ["番茄", "鸡蛋"] },
  紫菜蛋花汤: { items: ["紫菜", "鸡蛋"] },
};

const STAPLES: Record<Method, string[]> = {
  stir: ["食用油", "盐", "生抽", "大蒜", "姜"],
  pan: ["食用油", "盐"],
  drypot: ["食用油", "豆瓣酱", "干辣椒", "盐", "大蒜"],
  soup: ["盐", "姜", "小葱"],
  braise: ["食用油", "生抽", "老抽", "冰糖", "姜", "料酒"],
  cold: ["生抽", "香醋", "大蒜", "香油", "盐"],
  steam: ["姜", "小葱", "生抽", "料酒"],
  fry: ["食用油", "盐", "淀粉"],
  roast: ["食用油", "盐", "蜂蜜"],
  staple: ["食用油", "盐"],
  blanch: ["姜", "生抽"],
};

LEXICON.sort((a, b) => b[0].length - a[0].length);
FLAVORS.sort((a, b) => b[0].length - a[0].length);

export type Recipe = {
  ingredients: Ingredient[];
  steps: string[];
  method: Method;
  minutes: number;
  tags: string[];
  unparsed: boolean;
  /** high = override or clean parse; low = guessy template; none = unparsed */
  confidence: "high" | "low" | "none";
  fromOverride: boolean;
};

const cache = new Map<string, Recipe>();

export function methodOf(name: string, category: string): Method {
  if (/白灼/.test(name)) return "blanch";
  if (category === "凉菜" || /凉拌|沙拉|捞汁|炝拌/.test(name)) return "cold";
  if (/干锅|干煸|水煮/.test(name)) return "drypot";
  if (/炸|酥/.test(name)) return "fry";
  if (/煎/.test(name)) return "pan";
  if (/蒸|气锅|汽锅/.test(name)) return "steam";
  if (/烤/.test(name)) return "roast";
  if (/饭|炒面|拌面|火鸡面|泡面|饺子|煎饼/.test(name) || (category === "主食" && !/汤/.test(name))) {
    return "staple";
  }
  if (category === "汤" || /汤/.test(name)) return "soup";
  if (/红烧|葱烧|干烧|黄焖|焖|卤|炖|煲/.test(name)) return "braise";
  return "stir";
}

function postProcess(name: string, items: string[]): string[] {
  let next = items.slice();
  if (name.includes("红烧肉") || name.includes("回锅肉") || name.includes("粉蒸肉")) {
    next = next.map((item) => (item === "猪肉" ? "五花肉" : item));
  }
  if (name.includes("粉蒸") && !next.includes("蒸肉粉")) next.push("蒸肉粉");
  if (name.includes("饭") && !next.includes("米饭")) next.push("米饭");
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of next) {
    if (seen.has(item)) continue;
    seen.add(item);
    unique.push(item);
  }
  return unique;
}

function extractNames(name: string): string[] {
  let text = name.replaceAll("（", " ").replaceAll("）", " ").replaceAll("(", " ").replaceAll(")", " ");
  const found: string[] = [];
  for (const [phrase, adds] of FLAVORS) {
    if (!text.includes(phrase)) continue;
    text = text.replaceAll(phrase, " ".repeat(phrase.length));
    found.push(...adds);
  }
  const used = Array<boolean>(text.length).fill(false);
  const hits: { index: number; name: string }[] = [];
  for (const [word, canon] of LEXICON) {
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(word, from);
      if (index < 0) break;
      let overlap = false;
      for (let cursor = index; cursor < index + word.length; cursor += 1) {
        if (used[cursor]) overlap = true;
      }
      if (!overlap) {
        for (let cursor = index; cursor < index + word.length; cursor += 1) used[cursor] = true;
        hits.push({ index, name: canon });
      }
      from = index + word.length;
    }
  }
  hits.sort((a, b) => a.index - b.index);
  found.push(...hits.map((hit) => hit.name));
  return postProcess(name, found);
}

function classify(names: string[], guess: boolean): Ingredient[] {
  const seen = new Set<string>();
  const ingredients: Ingredient[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const seasoning = SEASONING.has(name);
    ingredients.push({
      name,
      role: seasoning ? "seasoning" : "main",
      uncertain: seasoning || guess,
    });
  }
  return ingredients;
}

function withStaples(ingredients: Ingredient[], method: Method): Ingredient[] {
  const have = new Set(ingredients.map((item) => item.name));
  const next = ingredients.slice();
  for (const name of STAPLES[method]) {
    if (have.has(name)) continue;
    if (name === "大蒜" && (have.has("蒜苗") || have.has("蒜苔"))) continue;
    next.push({ name, role: "seasoning", uncertain: true });
    have.add(name);
  }
  return next;
}

function estimate(name: string, category: string, method: Method): { minutes: number; tags: string[] } {
  const base: Record<Method, number> = {
    stir: 15,
    pan: 15,
    drypot: 25,
    soup: 45,
    braise: 55,
    cold: 12,
    steam: 30,
    fry: 25,
    roast: 35,
    staple: 20,
    blanch: 12,
  };
  let minutes = base[method];
  if (method === "soup" && /蛋花|紫菜|鸡蛋汤/.test(name) && !/排骨|牛|鸡|煲/.test(name)) minutes = 15;
  if ((method === "soup" || method === "braise") && /排骨|牛腩|筒子骨|炖|煲/.test(name)) minutes = 70;
  if (method === "staple" && /焖饭|粉蒸|炖/.test(name)) minutes = 40;
  const tags: string[] = [];
  if (minutes <= 20) tags.push("快手");
  if (method === "cold") tags.push("开胃");
  else if (method === "soup") tags.push("暖胃");
  else if (category === "主食" || method === "staple") tags.push("主食");
  else if (method === "braise" || method === "roast") tags.push("家常");
  else tags.push("下饭");
  return { minutes, tags: [...new Set(tags)].slice(0, 2) };
}

function buildSteps(method: Method, dish: string, mains: string[], unparsed: boolean): string[] {
  if (unparsed) {
    return [
      `「${dish}」这个名字一时拆不出稳妥主料，先看上面的视频确认买什么。`,
      "视频里的刀工和调味对齐后，再热锅下厨。",
      "做成功一次，就抄进「我们的账本」，下次不用猜。",
    ];
  }
  const ms = mains.join("、");
  switch (method) {
    case "pan":
      return [
        `把${ms}处理好，厚薄尽量均匀。`,
        "平底锅少油，中小火慢煎，先别急着翻。",
        "两面颜色到位再调盐，出锅前尝一口。",
        "火候拿不准就对照上面的视频。",
      ];
    case "drypot":
      return [
        `把${ms}洗净切好。`,
        "锅里少油，下豆瓣或干辣椒炒出红油。",
        `下${ms}，炒到入味、锅气起来。`,
        "按口味补盐，可撒葱花。",
      ];
    case "soup":
      return [
        `把${ms}洗净；荤的可先焯去浮沫。`,
        "冷水下锅，大火烧开后撇沫。",
        "转中小火，煮到软嫩。页面分钟数只是估算。",
        "出锅前加盐，可撒葱花。",
      ];
    case "braise":
      return [
        `把${ms}洗净，可先焯一下。`,
        "下油，放入生抽、老抽、姜和料酒。",
        "加热水没过食材，小火收到软烂。",
        "汁浓后尝咸淡，静置几分钟更入味。",
      ];
    case "cold":
      return [
        `把${ms}洗净切好。`,
        "可先盐抓或焯水过凉，看食材决定。",
        "调汁：生抽、香醋、蒜、香油，糖可加可不加。",
        "拌匀，冷藏十分钟更好吃。",
      ];
    case "steam":
      return [
        `把${ms}抹上生抽、姜和料酒。`,
        "水开后上锅，中火蒸到刚熟。",
        "出锅可淋一点热油或蒸汁。",
        "宁可比视频少看一眼，蒸过头会老。",
      ];
    case "fry":
      return [
        `把${ms}切好，薄薄裹一层淀粉或蛋液。`,
        "油温上来再下锅，炸到金黄。注意防溅。",
        "想更脆就捞出复炸一次。",
        "垫厨房纸吸油，趁热吃。",
      ];
    case "roast":
      return [
        `把${ms}擦干，抹油和盐。`,
        "烤箱或空气炸锅先预热。",
        "中途翻一次面，表面上色就可以。",
        "出炉后静置两分钟再切。",
      ];
    case "blanch":
      return [
        "锅里烧水，放几片姜。",
        `水开后下${ms}，变色熟透就捞。`,
        "蘸生抽或蒜蓉。",
        "白灼讲究快，久煮会老。",
      ];
    case "staple":
      if (/炒/.test(dish)) {
        return [
          `准备${ms}，按两人份估计量。`,
          "热锅少油，先把蛋或荤料炒散，再和主食一起翻。",
          "盐少放，边炒边尝。",
          "锅气起来就出锅，放久了会坨。",
        ];
      }
      if (/焖|炖|煲|蒸|烩/.test(dish)) {
        return [
          `把${ms}配好，水或汤汁一次加够。`,
          "电饭煲或小火收干都可以。",
          "出锅前尝咸淡，不够再补生抽。",
          "焖饭类静置五分钟再开，更易拨散。",
        ];
      }
      return [
        `准备${ms}。`,
        "炒的热锅，煮的等水开，焖的配好水。",
        "盐为主，有荤菜再加少许生抽。",
        "细节对照上面的视频最稳。",
      ];
    default:
      return [
        `把${ms}洗净处理好。`,
        "热锅倒油，可先下姜蒜爆香。",
        `下${ms}，大火快炒到变色、断生。`,
        "加盐和少许生抽，翻匀就出锅。",
      ];
  }
}

export function ingredientNote(ingredient: Ingredient): string {
  if (ingredient.role === "seasoning") {
    if (/盐|糖|冰糖|白糖/.test(ingredient.name)) return "少许";
    if (/油|酱|汁|料酒|醋|粉|淀粉/.test(ingredient.name)) return "适量";
    return "适量";
  }
  if (ingredient.uncertain) return "备好即可";
  return "两人份 · 适量";
}

type OverrideFile = Record<
  string,
  {
    ingredients?: Ingredient[];
    steps?: string[];
    minutes?: number;
    tags?: string[];
    method?: Method;
  }
>;

const OVERRIDE_MAP = overrides as OverrideFile;


const EXTRA_ALIASES: Record<string, string> = {
  糖: "白糖",
  葱: "小葱",
  蒜: "大蒜",
  酱油: "生抽",
  醋: "香醋",
  油: "食用油",
  小土豆: "土豆",
  西红柿: "番茄",
};

/** Normalize ingredient labels so shopping list can merge near-duplicates. */
export function canonicalizeIngredientName(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  // Drop trailing amounts: 鸡蛋3个 / 盐少许 / 生抽 1勺
  text = text
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(
      /\s*[\d０-９./／~～-]+\s*(g|kg|ml|l|克|千克|斤|两|个|只|根|条|片|块|颗|粒|勺|匙|茶匙|汤匙|杯|毫升|升|适量|少许)?\s*$/i,
      "",
    )
    .replace(/(少许|适量|若干|一点点)$/u, "")
    .trim();
  if (!text) text = raw.replace(/\s+/g, " ").trim();

  if (EXTRA_ALIASES[text]) return EXTRA_ALIASES[text];

  for (const [word, canon] of LEXICON) {
    if (text === word) return canon;
  }
  for (const [word, canon] of LEXICON) {
    if (text.includes(word)) return canon;
  }
  return text;
}

export function recipeFor(dish: Dish): Recipe {
  const cached = cache.get(dish.id);
  if (cached) return cached;

  const override = OVERRIDE_MAP[dish.name];
  if (override) {
    const method = override.method ?? methodOf(dish.name, dish.category);
    const { minutes, tags } = estimate(dish.name, dish.category, method);
    const ingredients = Array.isArray(override.ingredients)
      ? override.ingredients.filter(
          (item): item is Ingredient =>
            Boolean(item) && typeof item.name === "string" && item.name.trim().length > 0,
        )
      : [];
    const steps = Array.isArray(override.steps)
      ? override.steps.filter((step): step is string => typeof step === "string" && step.trim().length > 0)
      : [];
    // Incomplete override → fall through to generated recipe rather than crash the page.
    if (ingredients.length > 0 && steps.length > 0) {
      const recipe: Recipe = {
        ingredients,
        steps,
        method,
        minutes: typeof override.minutes === "number" && override.minutes > 0 ? override.minutes : minutes,
        tags: Array.isArray(override.tags) && override.tags.length > 0 ? override.tags : tags,
        unparsed: false,
        confidence: "high",
        fromOverride: true,
      };
      cache.set(dish.id, recipe);
      return recipe;
    }
  }

  const method = methodOf(dish.name, dish.category);
  const special = SPECIAL[dish.name];
  const names = postProcess(dish.name, special ? special.items : extractNames(dish.name));
  let ingredients = classify(names, Boolean(special?.guess));
  const unparsed = !ingredients.some((item) => item.role === "main");
  if (unparsed) ingredients = [];
  else ingredients = withStaples(ingredients, method);
  const mains = ingredients.filter((item) => item.role === "main").map((item) => item.name);
  const { minutes, tags } = estimate(dish.name, dish.category, method);
  const guessed = Boolean(special?.guess);
  const recipe: Recipe = {
    ingredients,
    steps: buildSteps(method, dish.name, mains, unparsed),
    method,
    minutes,
    tags,
    unparsed,
    confidence: unparsed ? "none" : guessed ? "low" : "high",
    fromOverride: false,
  };
  cache.set(dish.id, recipe);
  return recipe;
}

/** Plain-text ingredient list for copy / share —「名称 用量」per line. */
export function ingredientsPlainText(
  dishName: string,
  ingredients: Ingredient[],
  options?: { heading?: boolean },
): string {
  const lines: string[] = [];
  if (options?.heading !== false) lines.push(`${dishName} · 食材`);
  for (const ingredient of ingredients) {
    const raw = ingredient.name.trim();
    if (!raw) continue;
    const paren = raw.match(/^(.*?)[（(]\s*([^）)]+?)\s*[）)]\s*$/u);
    if (paren && paren[1].trim()) {
      lines.push(`${paren[1].trim()} ${paren[2].trim()}`);
      continue;
    }
    const trail = raw.match(
      /^(.*?)[\s　]*([\d０-９]+(?:\.\d+)?\s*(?:g|kg|ml|l|克|千克|斤|两|个|只|根|条|片|块|颗|粒|勺|匙|茶匙|汤匙|杯|毫升|升|碗|把|头|瓣)?|少许|适量|若干|一点点)\s*$/iu,
    );
    if (trail && trail[1].trim() && trail[2]) {
      lines.push(`${trail[1].trim()} ${trail[2].trim()}`);
      continue;
    }
    lines.push(`${raw} ${ingredientNote(ingredient)}`);
  }
  return lines.join("\n");
}


/** Aggregate plain-text ingredients for several dishes (tonight menu). */
export function menuIngredientsPlainText(
  items: { name: string; ingredients: Ingredient[] }[],
): string {
  const blocks: string[] = ["今晚食材清单"];
  for (const item of items) {
    if (!item.ingredients.length) continue;
    blocks.push("", ingredientsPlainText(item.name, item.ingredients));
  }
  return blocks.join("\n").trim();
}
