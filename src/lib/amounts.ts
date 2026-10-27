/** Shared quantity parsing for recipes, servings, shopping and exports. */
export type ParsedAmount = {
  qty: number | null;
  max?: number;
  unit: string;
  qual: string;
  raw: string;
};

const NUMBER = String.raw`(?:(?:\d+\s*又\s*)?\d+(?:\.\d+)?\s*[/／]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const UNIT =
  "(?:千克|毫升|茶匙|汤匙|人份|kg|ml|克|斤|两|个|只|根|条|片|块|颗|粒|勺|匙|杯|升|碗|把|头|瓣|g|l)";
const EXPRESSION = `${NUMBER}(?:\\s*[-–—~～至]\\s*${NUMBER})?`;
const QUANTITY = new RegExp(
  `^(${NUMBER})(?:\\s*([-–—~～至])\\s*(${NUMBER}))?\\s*(${UNIT})?$`,
  "iu",
);
const TRAILING = new RegExp(
  `^(.*?)\\s*(${EXPRESSION}\\s*${UNIT}|少许|适量|若干|一点点)$`,
  "iu",
);

function digits(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}

function numberOf(text: string): number {
  const mixed = text.split(/又/);
  const parts = mixed.at(-1)!.split(/[/／]/).map(Number);
  const fraction = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  return mixed.length === 2 ? Number(mixed[0]) + fraction : fraction;
}

export function parseAmount(raw: string): ParsedAmount {
  const text = digits(raw).replace(/\s+/g, " ").trim();
  const empty: ParsedAmount = {
    qty: null,
    unit: "",
    qual: "",
    raw: raw.trim(),
  };
  if (/^(少许|适量|若干|一点点|可选|备好即可)$/.test(text))
    return { ...empty, qual: text };
  const match = text.match(QUANTITY);
  if (!match) return empty;
  const qty = numberOf(match[1]);
  const max = match[3] ? numberOf(match[3]) : undefined;
  if (
    !Number.isFinite(qty) ||
    qty < 0 ||
    (max !== undefined && (!Number.isFinite(max) || max < qty))
  )
    return empty;
  return { qty, max, unit: match[4] ?? "", qual: "", raw: raw.trim() };
}

export function splitIngredientLabel(raw: string): {
  base: string;
  amount: ParsedAmount;
} {
  const text = raw.replace(/\s+/g, " ").trim();
  const paren = text.match(/^(.*?)[（(]\s*([^）)]+?)\s*[）)]\s*$/u);
  if (paren && paren[1].trim())
    return { base: paren[1].trim(), amount: parseAmount(paren[2]) };
  const trail = digits(text).match(TRAILING);
  if (trail && trail[1].trim() && !/[\d又/／]$/.test(trail[1].trim()))
    return { base: trail[1].trim(), amount: parseAmount(trail[2]) };
  return { base: text, amount: parseAmount("") };
}

function formatQty(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function amountDisplay(amount: ParsedAmount): string {
  if (amount.qty != null) {
    return `${formatQty(amount.qty)}${amount.max === undefined ? "" : `–${formatQty(amount.max)}`}${amount.unit}`;
  }
  return amount.qual || amount.raw;
}

export function scaleQuantityText(text: string, ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio === 1) return text;
  // Operate on complete quantities only; never multiply unrelated numbers in names.
  const direct = parseAmount(text);
  if (direct.qty !== null)
    return amountDisplay({
      ...direct,
      qty: direct.qty * ratio,
      max: direct.max === undefined ? undefined : direct.max * ratio,
    });
  const { base, amount } = splitIngredientLabel(text);
  if (amount.qty === null) return text;
  const scaled = amountDisplay({
    ...amount,
    qty: amount.qty * ratio,
    max: amount.max === undefined ? undefined : amount.max * ratio,
  });
  return /[（(]/u.test(text) ? `${base}（${scaled}）` : `${base} ${scaled}`;
}

export function formatIngredientCopyLine(
  raw: string,
  fallbackAmount = "",
): string {
  const { base, amount } = splitIngredientLabel(raw);
  const name = base.trim();
  if (!name) return "";
  const label = amountDisplay(amount) || fallbackAmount.trim();
  return label ? `${name} ${label}` : name;
}

export function mergeAmounts(parts: ParsedAmount[]): string {
  const totals = new Map<
    string,
    { min: number; max: number; range: boolean }
  >();
  const notes = new Set<string>();
  for (const part of parts) {
    if (part.qty === null) {
      const note = part.qual || part.raw;
      if (note) notes.add(note);
      continue;
    }
    const unit = part.unit.toLowerCase();
    const normalized =
      unit === "g"
        ? "克"
        : unit === "ml"
          ? "毫升"
          : unit === "kg" || unit === "千克"
            ? "克"
            : unit === "l" || unit === "升"
              ? "毫升"
              : unit;
    const factor = ["kg", "千克", "l", "升"].includes(unit) ? 1000 : 1;
    const total = totals.get(normalized) ?? { min: 0, max: 0, range: false };
    total.min += part.qty * factor;
    total.max += (part.max ?? part.qty) * factor;
    total.range ||= part.max !== undefined;
    totals.set(normalized, total);
  }
  return [
    ...[...totals].map(([unit, total]) =>
      amountDisplay({
        qty: total.min,
        max: total.range ? total.max : undefined,
        unit,
        qual: "",
        raw: "",
      }),
    ),
    ...notes,
  ].join("、");
}
