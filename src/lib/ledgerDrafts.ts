export type LedgerDraft = {
  name: string;
  ingredients: string;
  notes: string;
  image?: string;
  baseServings: number;
  savedAt: number;
};
const prefix = "jte.ledger.draft.";
export function loadLedgerDraft(id: string): LedgerDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(prefix + id) || "null");
    return value &&
      typeof value.name === "string" &&
      typeof value.ingredients === "string" &&
      typeof value.notes === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveLedgerDraft(id: string, draft: LedgerDraft): void {
  localStorage.setItem(prefix + id, JSON.stringify(draft));
}
export function clearLedgerDraft(id: string): void {
  localStorage.removeItem(prefix + id);
}
