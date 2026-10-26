import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  values = new Map();
  failKey = null;
  get length() {
    return this.values.size;
  }
  key(i) {
    return [...this.values.keys()][i] ?? null;
  }
  getItem(k) {
    return this.values.get(k) ?? null;
  }
  setItem(k, v) {
    if (this.failKey === k) {
      this.failKey = null;
      throw new Error("quota");
    }
    this.values.set(k, String(v));
  }
  removeItem(k) {
    this.values.delete(k);
  }
  clear() {
    this.values.clear();
  }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  dispatchEvent() {},
  matchMedia: () => ({ matches: false }),
};
globalThis.document = {
  documentElement: { dataset: {}, style: { setProperty() {} } },
};
const { emptyState, loadState, saveState, CORRUPT_STATE_KEY } =
  await import("../src/lib/storage.ts");
const { dishes } = await import("../src/data/catalog.ts");
const { recipeFor, canonicalizeIngredientName } =
  await import("../src/data/recipes.ts");
const { loadServingsForDish, saveServingsForDish, scaleAmountText } =
  await import("../src/lib/servings.ts");
const { buildShopping, buildShoppingByDish, shoppingText } =
  await import("../src/lib/shopping.ts");
const {
  parseLocalBackup,
  buildLocalBackup,
  applyLocalBackup,
  mergeLocalBackup,
  BACKUP_RECOVERY_KEY,
} = await import("../src/lib/backup.ts");
const {
  buildSyncPayload,
  parseSyncPayload,
  applySyncPayload,
  resetSyncClock,
  decideRemote,
} = await import("../src/lib/coupleSync.ts");
const { hemaUrl, validHemaTemplate } = await import("../src/lib/hema.ts");
beforeEach(() => localStorage.clear());

test("search templates only permit ordinary web links", () => {
  assert.equal(validHemaTemplate("javascript:alert(1)"), false);
  assert.equal(validHemaTemplate("data:text/html,test"), false);
  assert.equal(validHemaTemplate("https://example.com/?q={q}"), true);
  assert.ok(
    hemaUrl("鸡蛋", "javascript:alert(1)").startsWith(
      "https://www.freshippo.com/",
    ),
  );
  assert.ok(
    hemaUrl("鸡蛋", "https://example.com/?q={q}").includes(
      encodeURIComponent("鸡蛋"),
    ),
  );
});

test("backup restores local servings without importing room credentials", () => {
  saveServingsForDish(dishes[0].id, 4);
  localStorage.setItem(
    "jte.couple.room.v1",
    JSON.stringify({ code: "LOCAL1", role: "host" }),
  );
  const backup = buildLocalBackup();
  assert.equal(backup.localData["jte.servings.default"], undefined);
  assert.equal(backup.localData["jte.couple.room.v1"], undefined);
  saveServingsForDish(dishes[0].id, 1);
  applyLocalBackup(backup);
  assert.equal(loadServingsForDish(dishes[0].id), 4);
  assert.equal(
    JSON.parse(localStorage.getItem("jte.couple.room.v1")).code,
    "LOCAL1",
  );
});

test("fresh browsers use two servings and respect explicitly saved servings", () => {
  assert.equal(loadServingsForDish(dishes[0].id), 2);
  saveServingsForDish(dishes[0].id, 4);
  assert.equal(loadServingsForDish(dishes[0].id), 4);
  assert.equal(loadServingsForDish(dishes[1].id), 2);
});

test("whole quantities, ranges, fractions and fullwidth digits scale correctly", () => {
  for (const [input, expected] of [
    ["300-400g", "600–800g"],
    ["1/2勺", "1勺"],
    ["花甲（400克）", "花甲（800克）"],
    ["鸡蛋３个", "鸡蛋 6个"],
    ["十三香", "十三香"],
    ["3号土豆", "3号土豆"],
    ["盐少许", "盐少许"],
    ["1/0勺", "1/0勺"],
  ]) {
    assert.equal(scaleAmountText(input, 4), expected, input);
  }
});

test("shopping preserves measured quantities in both views and exported text", () => {
  const dish = dishes.find((d) => d.name === "香辣花甲虾");
  assert.ok(recipeFor(dish).ingredients.some((i) => i.name.includes("400克")));
  const input = {
    dishes: [dish],
    ledger: [],
    ledgerIds: [],
    extras: [],
    bought: [],
  };
  const list = buildShopping(input);
  assert.equal(list.foods.find((i) => i.name === "花甲").amount, "400克");
  assert.equal(
    buildShoppingByDish(input).groups[0].items.find((i) => i.name === "花甲")
      .amount,
    "400克",
  );
  assert.match(shoppingText(list), /花甲 400克/);
  saveServingsForDish(dish.id, 4);
  assert.equal(
    buildShopping(input).foods.find((i) => i.name === "花甲").amount,
    "800克",
  );
});

test("merged quantities sum equivalent units without dropping different units", () => {
  const list = buildShopping({
    dishes: [],
    ledger: [],
    ledgerIds: [],
    bought: [],
    extras: [
      { id: "a", name: "土豆300g" },
      { id: "b", name: "土豆1kg" },
      { id: "c", name: "土豆2个" },
    ],
  });
  assert.equal(list.foods.length, 1);
  assert.equal(list.foods[0].amount, "1300克、2个");
  assert.equal(canonicalizeIngredientName("青红椒"), "青红椒");
});

test("valid existing v1 states migrate optional fields and bad states are quarantined", () => {
  const state = emptyState();
  delete state.menuPinnedIds;
  delete state.tonightNote;
  localStorage.setItem("jte.v1", JSON.stringify(state));
  assert.deepEqual(loadState().menuPinnedIds, []);
  localStorage.setItem("jte.v1", "{broken");
  const recovered = loadState();
  saveState(recovered);
  assert.equal(localStorage.getItem(CORRUPT_STATE_KEY), "{broken");
});

test("incomplete backup and invalid nested fields are rejected before mutation", () => {
  const invalid = { kind: "jte-backup", v: 1, state: {} };
  assert.equal(parseLocalBackup(invalid), null);
  assert.throws(() => applyLocalBackup(invalid));
  assert.throws(() => mergeLocalBackup(invalid));
  const valid = buildLocalBackup();
  assert.ok(parseLocalBackup(valid));
  valid.state.hearts = "not an array";
  assert.equal(parseLocalBackup(valid), null);
  assert.equal(localStorage.getItem("jte.v1"), null);
});

test("import saves a recovery point and rolls state back after a write failure", () => {
  const state = emptyState();
  state.tonightNote = "original";
  saveState(state);
  const backup = buildLocalBackup();
  backup.state.tonightNote = "imported";
  localStorage.failKey = "jte.theme";
  assert.throws(() => applyLocalBackup(backup));
  assert.equal(loadState().tonightNote, "original");
  assert.equal(
    JSON.parse(localStorage.getItem(BACKUP_RECOVERY_KEY)).state.tonightNote,
    "original",
  );
  applyLocalBackup(backup);
  assert.equal(loadState().tonightNote, "imported");
});

test("sync omits large photos on wire and preserves the local photo when applied", () => {
  const state = emptyState();
  state.ledger = [
    {
      id: "photo",
      name: "菜",
      notes: "",
      ingredients: "鸡蛋",
      createdAt: 1,
      updatedAt: 1,
      image: "data:image/jpeg;base64," + "A".repeat(5000),
    },
  ];
  const pack = buildSyncPayload(state, 100);
  assert.equal(pack.ledger[0].image, undefined);
  assert.equal(
    applySyncPayload(state, pack).ledger[0].image,
    state.ledger[0].image,
  );
  assert.equal(parseSyncPayload({ v: 1, updatedAt: 100 }), null);
  assert.equal(parseSyncPayload({ ...pack, updatedAt: Infinity }), null);
  assert.ok(parseSyncPayload(pack));
});

test("sync does not treat a restart as a content edit and rejects invalid clocks", () => {
  resetSyncClock(100);
  assert.equal(localStorage.getItem("jte.sync.clock.v1"), "100");
  assert.equal(decideRemote(101).accept, true);
  assert.equal(decideRemote(NaN).accept, false);
});
