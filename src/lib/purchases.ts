import type { AppState } from "../types.ts";
import { dishById } from "../data/catalog.ts";
import { buildShopping } from "./shopping.ts";
import { purchaseToken } from "./purchaseTokens.ts";
export { purchaseToken, purchasePrefix } from "./purchaseTokens.ts";
export function shoppingForState(state: AppState) {
  return buildShopping({
    dishes: state.menuDishIds.flatMap((id) => {
      const dish = dishById.get(id);
      return dish ? [dish] : [];
    }),
    ledger: state.ledger,
    ledgerIds: state.menuLedgerIds,
    extras: state.extras,
    bought: state.bought,
  });
}
export function migrateBoughtTokens(state: AppState): AppState {
  if (!state.bought.some((value) => !value.startsWith("buy:"))) return state;
  const list = shoppingForState(state);
  return {
    ...state,
    bought: [
      ...state.bought.filter((value) => value.startsWith("buy:")),
      ...[...list.foods, ...list.seasonings]
        .filter((item) => state.bought.includes(item.name))
        .map(purchaseToken),
    ],
  };
}
