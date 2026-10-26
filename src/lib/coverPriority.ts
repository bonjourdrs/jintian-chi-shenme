/** How many dish covers to eager-load for the first grid row. */
export function firstRowPriorityCount(width = typeof window !== "undefined" ? window.innerWidth : 390): number {
  if (width >= 1200) return 4;
  if (width >= 880) return 3;
  return 2;
}
