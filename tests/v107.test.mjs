import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createLocalServer } from "../server/local.mjs";
import { createRoomStore } from "../server/room-store.mjs";
globalThis.localStorage = {
  values: new Map(),
  getItem(k) {
    return this.values.get(k) ?? null;
  },
  setItem(k, v) {
    this.values.set(k, String(v));
  },
  removeItem(k) {
    this.values.delete(k);
  },
  clear() {
    this.values.clear();
  },
};
globalThis.window = { dispatchEvent() {} };
const { emptyState } = await import("../src/lib/storage.ts");
const { recordSharedChanges, mergeSharedStates, documentFor } =
  await import("../src/lib/replica.ts");
const { buildSyncPayload, applySyncPayload } =
  await import("../src/lib/coupleSync.ts");
const {
  scaleAmountText,
  saveServingsForDish,
  loadServingsForDish,
  applyTonightUnifiedServings,
  clearTonightUnifiedServings,
} = await import("../src/lib/servings.ts");
const { buildShopping } = await import("../src/lib/shopping.ts");
const {
  ledgerIngredients,
  ingredientRole,
  splitIngredientText,
  ledgerServingsKey,
} = await import("../src/lib/ledgerIngredients.ts");
const { purchaseToken } = await import("../src/lib/purchaseTokens.ts");
const { migrateBoughtTokens } = await import("../src/lib/purchases.ts");
const { searchDishes, dishes } = await import("../src/data/catalog.ts");
const { saveCookSession, loadCookSession } =
  await import("../src/lib/cookSession.ts");
beforeEach(() => localStorage.clear());
const ledger = {
  id: "custom",
  name: "家常菜",
  notes: "旧备注",
  ingredients: "鸡蛋2个，盐少许",
  createdAt: 1,
  updatedAt: 1,
  baseServings: 2,
};
const base = () => ({ ...emptyState(), ledger: [ledger] });
test("33/34 independent fields and memberships converge despite equal or future wall clocks", () => {
  const s = base();
  const a = recordSharedChanges(
    s,
    { ...s, hearts: [dishes[0].id], ledger: [{ ...ledger, name: "新菜名" }] },
    "A",
  );
  const b = recordSharedChanges(
    s,
    { ...s, hearts: [dishes[1].id], ledger: [{ ...ledger, notes: "新备注" }] },
    "B",
  );
  const ab = mergeSharedStates(a, b),
    ba = mergeSharedStates(b, a);
  assert.deepEqual(ab.hearts, ba.hearts);
  assert.equal(ab.hearts.length, 2);
  assert.equal(ab.ledger[0].name, "新菜名");
  assert.equal(ab.ledger[0].notes, "新备注");
  assert.deepEqual(mergeSharedStates(ab, a), ab);
  const payload = buildSyncPayload(b);
  payload.updatedAt = 8e15;
  assert.equal(applySyncPayload(a, payload).ledger[0].notes, "新备注");
  const deleted = recordSharedChanges(a, { ...a, ledger: [] }, "A");
  assert.equal(mergeSharedStates(deleted, b).ledger.length, 0);
});
test("33 logical register merge is associative and same-field conflicts deterministic", () => {
  const s = base(),
    a = recordSharedChanges(s, { ...s, tonightNote: "A" }, "A"),
    b = recordSharedChanges(s, { ...s, tonightNote: "B" }, "B"),
    c = recordSharedChanges(s, { ...s, theme: "watercolor-market" }, "C");
  assert.deepEqual(
    mergeSharedStates(mergeSharedStates(a, b), c),
    mergeSharedStates(a, mergeSharedStates(b, c)),
  );
  assert.equal(
    mergeSharedStates(a, b).tonightNote,
    mergeSharedStates(b, a).tonightNote,
  );
});
test("37 local-only extras and checks do not advance shared revision", () => {
  const s = recordSharedChanges(
    base(),
    { ...base(), tonightNote: "test" },
    "A",
  );
  const next = recordSharedChanges(
    s,
    { ...s, extras: [{ id: "e", name: "鸡蛋2个" }], bought: ["鸡蛋"] },
    "A",
  );
  assert.deepEqual(documentFor(next), documentFor(s));
});
test("23 ingredient search returns actual ingredient matches", () => {
  assert.ok(searchDishes("冰糖").length > 0);
  assert.ok(searchDishes("鸡蛋").length > 0);
});
test("24/26/27/28 measured and unknown demand, ledger seasoning and delimiters agree", () => {
  const entry = {
    ...ledger,
    ingredients: "鸡蛋2个、鸡蛋适量;盐少许；生抽1勺\n土豆300g",
  };
  assert.equal(splitIngredientText(entry.ingredients).length, 5);
  assert.equal(ingredientRole("盐少许"), "seasoning");
  const list = buildShopping({
    dishes: [],
    ledger: [entry],
    ledgerIds: [entry.id],
    extras: [],
    bought: [],
  });
  const eggs = list.foods.find((x) => x.name === "鸡蛋");
  assert.match(eggs.amount, /2个/);
  assert.match(eggs.amount, /待定/);
  assert.equal(eggs.unknownCount, 1);
  assert.ok(list.seasonings.some((x) => x.name === "盐"));
  saveServingsForDish(ledgerServingsKey(entry.id), 4);
  assert.ok(ledgerIngredients(entry).some((x) => /鸡蛋.*4个/.test(x.name)));
  const four = { ...ledger, baseServings: 4 };
  assert.ok(ledgerIngredients(four).some((x) => /2个/.test(x.name)));
  localStorage.clear();
  assert.ok(ledgerIngredients(four).some((x) => /2个/.test(x.name)));
});
test("25 bought acknowledgement invalidates when demand grows, including migrated legacy flags", () => {
  const s = { ...base(), menuLedgerIds: ["custom"], bought: ["鸡蛋"] };
  const migrated = migrateBoughtTokens(s);
  assert.ok(migrated.bought[0].startsWith("buy:"));
  const options = {
    dishes: [],
    ledger: s.ledger,
    ledgerIds: s.menuLedgerIds,
    extras: [],
    bought: migrated.bought,
  };
  assert.ok(buildShopping(options).foods.find((x) => x.name === "鸡蛋").bought);
  const larger = buildShopping({
    ...options,
    extras: [{ id: "extra", name: "鸡蛋3个" }],
  }).foods.find((x) => x.name === "鸡蛋");
  assert.equal(larger.bought, false);
  assert.notEqual(purchaseToken(larger), migrated.bought[0]);
  assert.equal(larger.extraItems.length, 1);
});
test("29/30 individual servings do not change default, partial clear retains remaining snapshots", () => {
  saveServingsForDish("a", 3);
  saveServingsForDish("b", 5);
  assert.equal(loadServingsForDish("new"), 2);
  applyTonightUnifiedServings(["a", "b"], 4);
  clearTonightUnifiedServings(["a"]);
  assert.equal(loadServingsForDish("a"), 3);
  assert.equal(loadServingsForDish("b"), 4);
  clearTonightUnifiedServings(["b"]);
  assert.equal(loadServingsForDish("b"), 5);
});
test("12 cooking session preserves absolute timer deadline", () => {
  const session = {
    cookStep: 2,
    timerEndsAt: Date.now() + 60000,
    timerPausedLeft: null,
    timerInitialSecs: 60,
    timerStepIndex: 2,
    timerStepLabel: "焖煮",
    timerPresetMin: 1,
    savedAt: Date.now(),
  };
  saveCookSession("dish", session);
  assert.deepEqual(loadCookSession("dish"), session);
});
test("36 mixed fractions scale as whole-plus-fraction", () => {
  assert.equal(scaleAmountText("酱油1又1/2勺", 4), "酱油 3勺");
});
test("35 real HTTP CAS rejects competing writes and merges retry without losing either edit", async () => {
  const server = createLocalServer({ store: createRoomStore() });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/rooms`;
  try {
    const s = base(),
      headers = { "Content-Type": "application/json" };
    const room = await (
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildSyncPayload(s)),
      })
    ).json();
    const a = recordSharedChanges(s, { ...s, tonightNote: "甲" }, "A"),
      b = recordSharedChanges(s, { ...s, theme: "watercolor-market" }, "B");
    const writes = await Promise.all(
      [a, b].map((x) =>
        fetch(url + "/" + room.code, {
          method: "PUT",
          headers: { ...headers, "If-Match": "1" },
          body: JSON.stringify(buildSyncPayload(x)),
        }),
      ),
    );
    assert.deepEqual(writes.map((x) => x.status).sort(), [200, 409]);
    const remote = await (await fetch(url + "/" + room.code)).json();
    const loser = writes[0].status === 409 ? a : b;
    const merged = applySyncPayload(loser, remote.payload);
    assert.equal(
      (
        await fetch(url + "/" + room.code, {
          method: "PUT",
          headers: { ...headers, "If-Match": String(remote.revision) },
          body: JSON.stringify(buildSyncPayload(merged)),
        })
      ).status,
      200,
    );
    const final = applySyncPayload(
      s,
      (await (await fetch(url + "/" + room.code)).json()).payload,
    );
    assert.equal(final.tonightNote, "甲");
    assert.equal(final.theme, "watercolor-market");
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { ...headers, Origin: "https://evil.test" },
          body: JSON.stringify(buildSyncPayload(s)),
        })
      ).status,
      403,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
