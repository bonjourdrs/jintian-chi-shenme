/** A purchase acknowledges a demand, not just an ingredient name. */
function hash(text: string): string {
  let value = 14695981039346656037n;
  for (const char of text) {
    value ^= BigInt(char.codePointAt(0)!);
    value = BigInt.asUintN(64, value * 1099511628211n);
  }
  return value.toString(36);
}
export function purchasePrefix(name: string): string {
  return `buy:${hash(name)}:`;
}
export function purchaseToken(item: {
  name: string;
  amount: string;
  unknownCount?: number;
}): string {
  return `${purchasePrefix(item.name)}${hash(JSON.stringify([item.amount, item.unknownCount ?? 0]))}`;
}
export function isPurchased(
  item: { name: string; amount: string; unknownCount?: number },
  bought: string[],
): boolean {
  return bought.includes(purchaseToken(item)) || bought.includes(item.name);
}
