export type Tone = "red" | "gold" | "green" | "brown" | "orange" | "cream" | "pink";
export type DishKind = "soup" | "noodle" | "rice" | "cold" | "seafood" | "stir";
export type Motif = "home" | "meat" | "sea" | "veg" | "soup" | "cold" | "staple";

const TONE_RULES: [RegExp, Tone][] = [
  [/番茄|西红柿|胡萝卜|腊肠|香肠|红椒|辣椒|叉烧|柿/, "red"],
  [/蛋|玉米|南瓜|土豆|豆腐|年糕|米饭|笋/, "gold"],
  [/菜|瓜|椒|葱|蒜苗|蒜苔|豆|菇|西兰花|木耳|菠菜|生菜/, "green"],
  [/牛|猪|鸡|鸭|排|肉|肠|肝|肚|翅|爪/, "brown"],
  [/虾|蟹|鱼|鱿|鳝|鲍|花甲/, "orange"],
  [/紫菜|茄子/, "pink"],
];

export function dishTones(name: string, category: string): Tone[] {
  const tones: Tone[] = [];
  for (const [rule, tone] of TONE_RULES) {
    if (rule.test(name) && !tones.includes(tone)) tones.push(tone);
  }
  if (tones.length === 0) {
    const fallback: Record<string, Tone> = {
      家常热菜: "red",
      肉禽: "brown",
      海鲜: "orange",
      素菜: "green",
      汤: "gold",
      凉菜: "green",
      主食: "cream",
    };
    tones.push(fallback[category] ?? "gold");
  }
  if (tones.length === 1) tones.push(tones[0] === "green" ? "gold" : "green");
  return tones.slice(0, 4);
}

export function dishKind(name: string, category: string): DishKind {
  if (/鱼香/.test(name)) return "stir";
  if (category === "凉菜" || /凉拌|沙拉|捞汁|炝拌/.test(name)) return "cold";
  if (/面|粉条|粉丝|凉粉|饺|饼|火鸡面|泡面/.test(name) && !/粉丝虾/.test(name)) {
    return /凉粉|凉拌/.test(name) ? "cold" : "noodle";
  }
  if (/饭|锅巴/.test(name)) return "rice";
  if ((category === "汤" || /汤|煲/.test(name)) && !/饭/.test(name)) return "soup";
  if (category === "海鲜" || /虾|蟹|鱼|鱿|鳝|鲍|花甲/.test(name)) return "seafood";
  if (category === "主食") return "rice";
  return "stir";
}
