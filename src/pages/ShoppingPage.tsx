import { useMemo, useState } from "react";
import { BasketArt } from "../components/Art.tsx";
import { Link } from "react-router-dom";
import { dishById } from "../data/catalog.ts";
import {
  copyHemaKeywords,
  copyText,
  hemaKeywords,
  hemaSearchTerm,
  openHema,
} from "../lib/hema.ts";
import { isOnline } from "../lib/online.ts";
import { buildShopping, buildShoppingByDish, shoppingText } from "../lib/shopping.ts";
import { loadShopGroupMode, saveShopGroupMode, type ShopGroupMode } from "../lib/shopMode.ts";
import { loadHideBought, saveHideBought } from "../lib/shopHideBought.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import { hapticTap } from "../lib/haptics.ts";
import { useTitle } from "../lib/useTitle.ts";
import { useApp } from "../state/store.tsx";
import type { ShopItem } from "../lib/shopping.ts";

export function ShoppingPage() {
  useTitle("采购清单");
  const {
    state,
    toggleBought,
    clearBought,
    setBought,
    addExtra,
    removeExtra,
    clearExtras,
    restoreExtras,
    removeDishFromMenu,
    removeLedgerFromMenu,
    rollTonight,
    toast,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [hemaIndex, setHemaIndex] = useState(0);
  const [hemaActive, setHemaActive] = useState(false);
  const [hideBought, setHideBought] = useState(() => loadHideBought());
  const [groupMode, setGroupMode] = useState<ShopGroupMode>(() => loadShopGroupMode());

  const pickGroupMode = (mode: ShopGroupMode) => {
    setGroupMode(mode);
    saveShopGroupMode(mode);
  };

  const list = useMemo(() => {
    const menuDishes = state.menuDishIds
      .map((id) => dishById.get(id))
      .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
    return buildShopping({
      dishes: menuDishes,
      ledger: state.ledger,
      ledgerIds: state.menuLedgerIds,
      extras: state.extras,
      bought: state.bought,
    });
  }, [state.bought, state.extras, state.ledger, state.menuDishIds, state.menuLedgerIds]);

  const byDish = useMemo(() => {
    const menuDishes = state.menuDishIds
      .map((id) => dishById.get(id))
      .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
    return buildShoppingByDish({
      dishes: menuDishes,
      ledger: state.ledger,
      ledgerIds: state.menuLedgerIds,
      extras: state.extras,
      bought: state.bought,
    });
  }, [state.bought, state.extras, state.ledger, state.menuDishIds, state.menuLedgerIds]);

  const total = list.foods.length + list.seasonings.length;
  const empty = total === 0 && list.sources.length === 0;

  const uncheckedItems = useMemo(
    () => [...list.foods, ...list.seasonings].filter((item) => !item.bought),
    [list.foods, list.seasonings],
  );
  const uncheckedTerms = useMemo(
    () => hemaKeywords(uncheckedItems.map((item) => item.name)),
    [uncheckedItems],
  );

  const copyList = async () => {
    if (!oncePrimary("shop-copy")) return;
    const ok = await copyText(shoppingText(list));
    toast(ok ? "已复制（含未勾选的盒马可搜关键词）" : "没能复制，请手动选择文字");
  };

  const copyUncheckedList = async () => {
    if (!oncePrimary("shop-copy-unchecked")) return;
    const open = [...list.foods, ...list.seasonings].filter((item) => !item.bought);
    if (open.length === 0) {
      toast("没有未勾选项");
      return;
    }
    const ok = await copyText(shoppingText(list, new Date(), { uncheckedOnly: true }));
    toast(ok ? `已复制 ${open.length} 项未勾选` : "没能复制，请手动选择文字");
  };

  const copyUncheckedForHema = async () => {
    await copyHemaKeywords(
      uncheckedItems.map((item) => item.name),
      toast,
    );
  };

  const startHemaWalk = () => {
    if (uncheckedTerms.length === 0) {
      toast("没有未勾选的食材可搜");
      return;
    }
    if (!isOnline()) {
      toast("需要联网才能打开盒马搜索");
      return;
    }
    setHemaActive(true);
    setHemaIndex(0);
    openHema(uncheckedTerms[0]!, state.hemaTemplate, toast);
    if (uncheckedTerms.length > 1) {
      toast(`已开第 1/${uncheckedTerms.length}：${uncheckedTerms[0]} · 不是一键加购`);
    }
  };

  const nextHema = () => {
    if (!isOnline()) {
      toast("需要联网才能打开盒马搜索");
      return;
    }
    const next = hemaIndex + 1;
    if (next >= uncheckedTerms.length) {
      setHemaActive(false);
      setHemaIndex(0);
      toast("未勾选的都搜过了");
      return;
    }
    setHemaIndex(next);
    openHema(uncheckedTerms[next]!, state.hemaTemplate, toast);
    toast(`已开第 ${next + 1}/${uncheckedTerms.length}：${uncheckedTerms[next]}`);
  };

  const stopHemaWalk = () => {
    setHemaActive(false);
    setHemaIndex(0);
  };

  const renderItem = (item: ShopItem, keyPrefix = "") => (
    <li key={`${keyPrefix}${item.role}-${item.name}`} className={item.bought ? "shop-item is-bought" : "shop-item"}>
      <label className="shop-check">
        <input type="checkbox" checked={item.bought} onChange={() => toggleBought(item.name)} />
        <span>
          <strong>
            {item.name}
            {item.extraId ? (
              <em className="temp-chip" title="临时项 · 仅本机 · 不进同步">
                仅本机
              </em>
            ) : null}
            {item.sourceCount > 1 ? (
              <em className="merge-chip" title="多道菜共用，已合并去重">
                合并×{item.sourceCount}
              </em>
            ) : null}
          </strong>
          <small>{item.detail}</small>
        </span>
      </label>
      <span className="shop-actions">
        {item.extraId && (
          <button type="button" className="linkish" onClick={() => removeExtra(item.extraId ?? "")}>
            删掉
          </button>
        )}
        <button
          type="button"
          className="hema-btn"
          onClick={() => openHema(item.name, state.hemaTemplate, toast)}
          title={`复制并打开盒马搜索「${hemaSearchTerm(item.name) || item.name}」· 不是一键加购`}
          aria-label={`在盒马搜「${hemaSearchTerm(item.name) || item.name}」，仅搜索不是加购`}
        >
          <span className="hema-btn-main">在盒马搜</span>
          <span className="hema-btn-q">搜「{hemaSearchTerm(item.name) || item.name}」</span>
        </button>
      </span>
    </li>
  );

  return (
    <div className="page">
      <header className="page-intro">
        <p className="eyebrow">买完就回家做饭</p>
        <h1 className="page-title">采购清单</h1>
        <p className="hint">
          食材从菜名拆出来。可按菜分看，或合并去重；勾选与下方临时项只记在本机，不进双人同步。
          {list.servingsScaled
            ? "用量按详情里记过的份数缩放（未改菜谱底稿）。"
            : "份量默认按两人份心估。"}
        </p>
      </header>

      {empty ? (
        <div className="empty shop-empty">
          <span className="empty-art shop-empty-art" aria-hidden="true">
            <BasketArt />
          </span>
          <strong>清单还是空的</strong>
          <p>先摇一桌，或从菜单里挑今晚要做的。也可先记一条仅本机的临时项。</p>
          <div className="empty-actions">
            <button type="button" className="btn-primary" onClick={() => { if (!oncePrimary("roll")) return; rollTonight(); }}>
              随机开饭
            </button>
            <Link className="btn-ghost" to="/">
              看今晚菜单
            </Link>
          </div>
          <form
            className="add-row shop-temp-add"
            onSubmit={(event) => {
              event.preventDefault();
              const name = draft.trim();
              if (!name) return;
              addExtra(name);
              setDraft("");
              toast("已加临时项（仅本机，不进同步）");
              hapticTap();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="临时加一样，比如香菜"
              aria-label="添加临时食材，仅本机"
            />
            <button type="submit" className="btn-ghost" disabled={!draft.trim()}>
              加上
            </button>
          </form>
          <p className="hint shop-temp-hint">临时项仅本机，不进双人同步；新开今晚不会自动清掉。</p>
        </div>
      ) : (
        <>
          {(() => {
            const unchecked = [...list.foods, ...list.seasonings].filter((i) => !i.bought).length;
            const merged = [...list.foods, ...list.seasonings].filter((i) => i.sourceCount > 1).length;
            return (
              <>
                <p className="shop-summary" role="status">
                  <span className="shop-summary-left">
                    未勾选 <strong className="shop-unchecked-n">{unchecked}</strong> 项
                    {total - unchecked > 0 ? (
                      <>
                        {" "}
                        · 已勾选 <strong>{total - unchecked}</strong>
                        {hideBought ? "（已折叠）" : ""}
                      </>
                    ) : null}
                    {merged > 0 ? <> · 已合并去重 <strong>{merged}</strong> 项</> : null}
                    {list.servingsScaled ? <> · <em className="servings-scale-note">用量按详情份数</em></> : null}
                  </span>
                  <span className="shop-summary-right">共 {total} 项</span>
                </p>
                {total - unchecked > 0 ? (
                  <label className="shop-hide-bought">
                    <input
                      type="checkbox"
                      checked={hideBought}
                      onChange={(event) => {
                        const on = event.target.checked;
                        setHideBought(on);
                        saveHideBought(on);
                      }}
                    />
                    <span>折叠已勾选</span>
                  </label>
                ) : null}
                <p className="print-servings shop-print-servings" aria-hidden="true">
                  {list.servingsScaled ? "用量按详情里记过的份数缩放" : "份量默认按两人份心估"}
                </p>
              </>
            );
          })()}

          {list.sources.length > 0 && (
            <div className="source-row">
              {list.sources.map((source) => (
                <button
                  key={source.key}
                  type="button"
                  className="source-chip"
                  onClick={() =>
                    source.kind === "dish"
                      ? removeDishFromMenu(source.key.slice(5))
                      : removeLedgerFromMenu(source.key.slice(7))
                  }
                >
                  {source.name} ×
                </button>
              ))}
            </div>
          )}

          {groupMode === "merged" && list.unparsed.length > 0 && (
            <p className="hint">这几道没拆出主料，待完善：{list.unparsed.join("、")}</p>
          )}

          <div className="shop-group-toggle segmented" role="tablist" aria-label="采购分组">
            <button
              type="button"
              role="tab"
              aria-selected={groupMode === "merged"}
              className={groupMode === "merged" ? "seg on" : "seg"}
              onClick={() => pickGroupMode("merged")}
            >
              合并
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={groupMode === "by-dish"}
              className={groupMode === "by-dish" ? "seg on" : "seg"}
              onClick={() => pickGroupMode("by-dish")}
            >
              按菜
            </button>
          </div>

          {groupMode === "by-dish" ? (
            <div className="shop-by-dish">
              {byDish.groups.map((group) => (
                <section key={group.key} className="shop-dish-group">
                  <h2 className="block-title">{group.name}</h2>
                  {group.items.length === 0 ? (
                    <p className="hint">这道还没拆出主料，先对照视频。</p>
                  ) : (
                    <ul className="shop-list">{group.items.filter((item) => !(hideBought && item.bought)).map((item) => renderItem(item, `${group.key}:`))}</ul>
                  )}
                </section>
              ))}
              {byDish.unparsed.length > 0 && groupMode === "by-dish" ? (
                <p className="hint">主料待完善：{byDish.unparsed.join("、")}</p>
              ) : null}
            </div>
          ) : (
            <>
              {list.foods.length > 0 && (
                <section>
                  <h2 className="block-title">食材</h2>
                  <p className="hint">从菜名里拆出来的，已合并去重。</p>
                  <ul className="shop-list">{list.foods.filter((item) => !(hideBought && item.bought)).map((item) => renderItem(item))}</ul>
                </section>
              )}

              {list.seasonings.length > 0 && (
                <section>
                  <h2 className="block-title">调味</h2>
                  <p className="hint">家常估算，下锅前再对一眼。待完善。</p>
                  <ul className="shop-list">{list.seasonings.filter((item) => !(hideBought && item.bought)).map((item) => renderItem(item))}</ul>
                </section>
              )}
            </>
          )}

          <form
            className="add-row shop-temp-add"
            onSubmit={(event) => {
              event.preventDefault();
              const name = draft.trim();
              if (!name) return;
              addExtra(name);
              setDraft("");
              toast("已加临时项（仅本机，不进同步）");
              hapticTap();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="临时加一样，比如香菜"
              aria-label="添加临时食材，仅本机"
            />
            <button type="submit" className="btn-ghost" disabled={!draft.trim()}>
              加上
            </button>
          </form>
          <p className="hint shop-temp-hint">
            临时项仅本机：换一桌今晚也不自动清空；勾选跟采购勾选一起存。清掉某行点「删掉」，或在清单里取消勾选不影响条目本身。
          </p>
          {state.extras.length > 0 ? (
            <div className="row-btns shop-temp-clear-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const { extras } = clearExtras();
                  if (extras.length === 0) {
                    toast("没有临时项");
                    return;
                  }
                  hapticTap();
                  toast(`已清除 ${extras.length} 条临时项`, {
                    ms: 7000,
                    undo: () => {
                      restoreExtras(extras);
                      toast("已恢复临时项");
                    },
                  });
                }}
              >
                清除临时项（{state.extras.length}）
              </button>
            </div>
          ) : null}

          {uncheckedTerms.length > 0 ? (
            <section className="panel hema-multi" aria-label="盒马多词搜索">
              <div className="block-head">
                <h2 className="block-title" style={{ margin: 0 }}>
                  盒马搜索
                </h2>
                <span className="hema-multi-count">{uncheckedTerms.length} 个未勾选</span>
              </div>
              <p className="hint hema-honest-hint">
                只是搜索 / 深链，不是一键加购。可逐条打开，或复制关键词去 App 粘贴。
              </p>
              <div className="hema-keyword-preview" aria-label="关键词预览">
                {uncheckedTerms.slice(0, 12).map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="chip hema-kw-chip"
                    title={`在盒马搜「${term}」`}
                    onClick={() => openHema(term, state.hemaTemplate, toast)}
                  >
                    {term}
                  </button>
                ))}
                {uncheckedTerms.length > 12 ? (
                  <span className="hint">…还有 {uncheckedTerms.length - 12} 个</span>
                ) : null}
              </div>
              <div className="row-btns wrap hema-multi-actions">
                <button type="button" className="btn-secondary" onClick={startHemaWalk}>
                  逐条在盒马搜
                </button>
                <button type="button" className="btn-ghost" onClick={() => void copyUncheckedForHema()}>
                  复制未勾选关键词
                </button>
              </div>
              {hemaActive ? (
                <div className="hema-walk-bar" role="status">
                  <span>
                    正在逐条搜 · 第 {Math.min(hemaIndex + 1, uncheckedTerms.length)}/
                    {uncheckedTerms.length}
                    {uncheckedTerms[hemaIndex] ? ` · ${uncheckedTerms[hemaIndex]}` : ""}
                  </span>
                  <span className="hema-walk-actions">
                    <button type="button" className="btn-secondary compact" onClick={nextHema}>
                      下一条
                    </button>
                    <button type="button" className="btn-ghost compact" onClick={stopHemaWalk}>
                      结束
                    </button>
                  </span>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="row-btns stack-top shop-check-toolbar">
            <button type="button" className="btn-primary" onClick={() => void copyList()}>
              复制清单
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void copyUncheckedList()}
              disabled={uncheckedItems.length === 0}
              title={uncheckedItems.length === 0 ? "没有未勾选项" : "只复制尚未勾选的食材行"}
            >
              复制未勾选
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const names = [...list.foods, ...list.seasonings].map((item) => item.name);
                if (names.length === 0) {
                  toast("清单是空的");
                  return;
                }
                setBought(names);
                toast(`已全选勾选 ${names.length} 项（只影响本机）`);
              }}
            >
              全选勾选
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const items = [...list.foods, ...list.seasonings];
                if (items.length === 0) {
                  toast("清单是空的");
                  return;
                }
                const next = items.filter((item) => !item.bought).map((item) => item.name);
                setBought(next);
                toast(`已反选（未勾 ${next.length} / 共 ${items.length}，只影响本机）`);
              }}
            >
              反选
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                clearBought();
                toast("已清除勾选（只影响本机）");
              }}
              disabled={state.bought.length === 0}
            >
              清除已勾选
            </button>
          </div>

          <p className="hema-note hema-honest-hint">
            <strong>「在盒马搜」</strong>会复制关键词并打开搜索页（中文会做 URL 编码），同时试一次唤起淘宝/盒马系 App。
            这是搜索 / 深链，不是 SKU 一键加购；没有公开加购接口，也不会假装放进购物车。
            唤不起或弹窗被拦时，打开盒马 App 粘贴最省事。链接模板在「我们」里可改。
          </p>
        </>
      )}
    </div>
  );
}
