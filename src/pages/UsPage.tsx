import { useEffect, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CoupleMark, EmptyArt } from "../components/Art.tsx";
import { SearchIcon } from "../components/Icons.tsx";
import { SOURCE, dishById, likesOf } from "../data/catalog.ts";
import { APP_VERSION, LIVE_URL, SW_CACHE } from "../lib/version.ts";
import { estimateLocalUsage, formatStorageKb } from "../lib/storageEstimate.ts";
import {
  applyLocalBackup,
  downloadLocalBackup,
  downloadSyncRecovery,
  mergeLocalBackup,
  parseLocalBackup,
  type LocalBackup,
} from "../lib/backup.ts";
import { loadPrefFold, savePrefFold } from "../lib/prefFolds.ts";
import {
  loadWantSort,
  saveWantSort,
  type WantSortMode,
} from "../lib/wantSort.ts";
import {
  loadWantNotTonight,
  saveWantNotTonight,
} from "../lib/wantNotTonight.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import { formatSyncTime, normalizeRoomCode } from "../lib/coupleSync.ts";
import { Sheet } from "../components/Sheet.tsx";
import { useCouple } from "../state/couple.tsx";
import {
  DEFAULT_HEMA_TEMPLATE,
  HEMA_PRESETS,
  validHemaTemplate,
} from "../lib/hema.ts";
import { mealSummary } from "../lib/meal.ts";
import { useTitle } from "../lib/useTitle.ts";
import { useApp } from "../state/store.tsx";
import { THEMES } from "../theme/themes.ts";
import {
  applyDensity,
  loadDensity,
  saveDensity,
  type ListDensity,
} from "../lib/density.ts";
import {
  applyGridCols,
  loadGridCols,
  saveGridCols,
  type GridColsPref,
} from "../lib/gridCols.ts";
import {
  applyGridGap,
  loadGridGap,
  saveGridGap,
  type GridGapPref,
} from "../lib/gridGap.ts";
import { loadThemePulse, saveThemePulse } from "../lib/themePulse.ts";
import {
  loadDisplayNick,
  saveDisplayNick,
  sanitizeNick,
} from "../lib/nicks.ts";
import {
  clearSyncLog,
  formatSyncLogWhen,
  loadSyncLog,
  syncLogLabel,
  type SyncLogEntry,
} from "../lib/syncLog.ts";
import {
  hapticTap,
  loadHapticsEnabled,
  saveHapticsEnabled,
} from "../lib/haptics.ts";
import {
  loadTimerChime,
  saveTimerChime,
  playTimerChime,
} from "../lib/timerChime.ts";
import { canSpeak, loadCookSpeak, saveCookSpeak } from "../lib/cookSpeak.ts";
import { replayOnboard } from "../lib/onboard.ts";

export function UsPage() {
  const navigate = useNavigate();
  useTitle("我们");
  const {
    state,
    setTheme,
    setHemaTemplate,
    openMeal,
    openThemes,
    toast,
    addDishesToMenu,
    restoreMenu,
    rollTonight,
    removeHeart,
    insertHeartAt,
    removeHearts,
    restoreHearts,
    reorderHearts,
    moveHeart,
  } = useApp();
  const {
    room,
    setRoom,
    joinCode,
    setJoinCode,
    joinError,
    setJoinError,
    joinInputRef,
    pasteDraft,
    setPasteDraft,
    status,
    busy,
    leaveConfirm,
    setLeaveConfirm,
    createRoom,
    joinRoom,
    retryPair,
    leaveRoom,
    confirmLeaveRoom,
    syncNow,
    cancelSync,
    copyInvite,
    copyRoom,
    shareInvite,
    copyPack,
    downloadPack,
    sharePack,
    applyPaste,
  } = useCouple();
  const [density, setDensity] = useState<ListDensity>(() => loadDensity());
  const [gridCols, setGridCols] = useState<GridColsPref>(() => loadGridCols());
  const [gridGap, setGridGap] = useState<GridGapPref>(() => loadGridGap());
  const [themePulseOn, setThemePulseOn] = useState(() => loadThemePulse());
  const [hapticsOn, setHapticsOn] = useState(() => loadHapticsEnabled());
  const [timerChimeOn, setTimerChimeOn] = useState(() => loadTimerChime());
  const [cookSpeakOn, setCookSpeakOn] = useState(() => loadCookSpeak());
  const [pendingBackup, setPendingBackup] = useState<LocalBackup | null>(null);
  const [prefFeelOpen, setPrefFeelOpen] = useState(() => loadPrefFold("feel"));
  const [prefLayoutOpen, setPrefLayoutOpen] = useState(() =>
    loadPrefFold("layout"),
  );
  const [storageLabel, setStorageLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const est = await estimateLocalUsage();
        if (cancelled || !est) return;
        const local = formatStorageKb(est.localBytes);
        if (!local) return;
        if (est.cacheBytes != null && est.cacheBytes > 0) {
          const cache = formatStorageKb(est.cacheBytes);
          setStorageLabel(
            cache ? `${local}（local）· ${cache}（缓存）` : local,
          );
        } else {
          setStorageLabel(local);
        }
      } catch {
        /* hide on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [myNick, setMyNick] = useState(() => loadDisplayNick());
  const [template, setTemplate] = useState(state.hemaTemplate);
  const [heartQuery, setHeartQuery] = useState("");
  const [wantSelect, setWantSelect] = useState(false);
  const [wantPicked, setWantPicked] = useState<string[]>([]);
  const [wantSort, setWantSort] = useState<WantSortMode>(() => loadWantSort());
  const [wantNotTonight, setWantNotTonight] = useState(() =>
    loadWantNotTonight(),
  );
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>(() => loadSyncLog());
  const [wantDrag, setWantDrag] = useState<number | null>(null);
  const [wantOver, setWantOver] = useState<number | null>(null);

  const hearts = (() => {
    let list = state.hearts
      .map((id) => dishById.get(id))
      .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
    if (wantNotTonight) {
      const tonight = new Set(state.menuDishIds);
      list = list.filter((dish) => !tonight.has(dish.id));
    }
    if (wantSort === "category") {
      return [...list].sort(
        (a, b) =>
          a.category.localeCompare(b.category, "zh") ||
          a.name.localeCompare(b.name, "zh"),
      );
    }
    if (wantSort === "likes") {
      return [...list].sort(
        (a, b) =>
          likesOf(b).n - likesOf(a).n || a.name.localeCompare(b.name, "zh"),
      );
    }
    /* recent / custom = hearts array order (synced) */
    return list;
  })();
  const wantCanReorder =
    (wantSort === "recent" || wantSort === "custom") &&
    !wantSelect &&
    !heartQuery.trim();

  const onWantDragStart = (index: number) => (event: DragEvent) => {
    setWantDrag(index);
    try {
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.effectAllowed = "move";
    } catch {
      /* ignore */
    }
  };
  const onWantDragOver = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    setWantOver(index);
  };
  const onWantDrop = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (wantDrag === null || wantDrag === index) {
      setWantDrag(null);
      setWantOver(null);
      return;
    }
    reorderHearts(wantDrag, index);
    if (wantSort === "recent") {
      setWantSort("custom");
      saveWantSort("custom");
    }
    setWantDrag(null);
    setWantOver(null);
    hapticTap();
  };
  const onWantDragEnd = () => {
    setWantDrag(null);
    setWantOver(null);
  };

  const [showInstallTip, setShowInstallTip] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (window.localStorage.getItem("jte-pwa-tip-dismissed") === "1")
        return false;
    } catch {
      /* ignore */
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in navigator &&
        Boolean(
          (navigator as Navigator & { standalone?: boolean }).standalone,
        ));
    return !standalone;
  });
  const dismissInstallTip = () => {
    try {
      window.localStorage.setItem("jte-pwa-tip-dismissed", "1");
    } catch {
      /* ignore */
    }
    setShowInstallTip(false);
  };

  useEffect(() => {
    const refresh = () => setSyncLog(loadSyncLog());
    window.addEventListener("jte-sync-log", refresh as EventListener);
    return () =>
      window.removeEventListener("jte-sync-log", refresh as EventListener);
  }, []);

  const wantListForAdd = (() => {
    const q = heartQuery.trim().toLowerCase();
    const list = hearts.filter((dish): dish is NonNullable<typeof dish> =>
      Boolean(dish),
    );
    if (!q) return list;
    return list.filter((dish) => dish.name.toLowerCase().includes(q));
  })();

  const addWantsToTonight = () => {
    const ids = wantListForAdd.map((dish) => dish.id);
    if (ids.length === 0) {
      toast("没有可加入的菜");
      return;
    }
    const snapDishes = state.menuDishIds.slice();
    const snapLedgers = state.menuLedgerIds.slice();
    const snapNote = state.tonightNote || "";
    const { added, skipped, undoToken } = addDishesToMenu(ids);
    if (added === 0) {
      toast(skipped > 0 ? `加入 0 道，跳过 ${skipped} 道` : "没有可加入的菜", {
        ms: 5200,
        ...(skipped > 0
          ? { actionLabel: "去看看", undo: () => navigate("/tonight") }
          : {}),
      });
      return;
    }
    hapticTap();
    toast(`加入 ${added} 道，跳过 ${skipped} 道`, {
      ms: 7000,
      undo: () => {
        const ok = restoreMenu(snapDishes, snapLedgers, snapNote, undoToken);
        toast(ok ? "已撤销批量加入" : "撤销已失效");
      },
    });
  };

  const pickGridCols = (next: GridColsPref) => {
    setGridCols(next);
    saveGridCols(next);
    applyGridCols(next);
  };

  const pickGridGap = (next: GridGapPref) => {
    setGridGap(next);
    saveGridGap(next);
    applyGridGap(next);
    toast(
      next === "tight"
        ? "桌面间距：紧"
        : next === "loose"
          ? "桌面间距：松"
          : "桌面间距：标准",
    );
  };

  const pickDensity = (next: ListDensity) => {
    setDensity(next);
    saveDensity(next);
    applyDensity(next);
    toast(next === "compact" ? "列表改为紧凑" : "列表改为舒适");
  };

  return (
    <div className="page">
      <Sheet
        open={leaveConfirm}
        title="退出配对房间？"
        onClose={() => setLeaveConfirm(false)}
        compact
      >
        <p>同步连接会断开，这台设备里的菜单、账本和勾选都会保留。</p>
        <div className="row-btns wrap">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setLeaveConfirm(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={confirmLeaveRoom}
          >
            确认退出
          </button>
        </div>
      </Sheet>

      {busy ? (
        <button type="button" className="btn-secondary" onClick={cancelSync}>
          取消网络请求
        </button>
      ) : null}
      <header className="us-hero">
        <CoupleMark />
        <div>
          <p className="eyebrow">两个人</p>
          <h1 className="page-title">我们</h1>
          <p className="hint">想吃、今晚菜单和账本，可以开个房间一起改。</p>
        </div>
      </header>

      {showInstallTip && (
        <aside className="install-tip" role="status">
          <p>
            这是个小网页应用。用手机浏览器打开时，可以「添加到主屏幕」，下次像
            App 一样点开。
          </p>
          <button type="button" className="linkish" onClick={dismissInstallTip}>
            知道了
          </button>
        </aside>
      )}

      <section className="panel" id="wants">
        <p className="hint sync-scope-line want-sync-line">
          想吃会随房间同步给对方；今晚、账本、几菜几汤与皮肤也会同步。采购勾选、临时项与步骤勾选只留本机。
        </p>
        <div className="section-head want-head">
          <h2>
            想吃
            {hearts.length > 0 ? (
              <em
                className="count-chip"
                aria-label={`想吃 ${hearts.length} 道`}
              >
                想吃 {hearts.length}
              </em>
            ) : null}
          </h2>
        </div>
        {state.hearts.length === 0 ? (
          <div className="empty want-empty">
            <EmptyArt kind="want" />
            <strong>还没有想吃的菜</strong>
            <p>
              在菜卡点颗心，或先摇一桌碰运气，喜欢的再留在这里。配对后想吃列表会同步给对方。
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!oncePrimary("roll")) return;
                  rollTonight();
                }}
              >
                随机开饭
              </button>
              <Link className="btn-ghost" to="/browse">
                去翻菜单
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="want-filter-row" role="group" aria-label="想吃筛选">
              <button
                type="button"
                className={
                  wantNotTonight
                    ? "chip on want-not-tonight-chip"
                    : "chip want-not-tonight-chip"
                }
                aria-pressed={wantNotTonight}
                title="只看还没放进今晚菜单的想吃"
                onClick={() => {
                  const next = !wantNotTonight;
                  setWantNotTonight(next);
                  saveWantNotTonight(next);
                  hapticTap();
                }}
              >
                未进今晚
              </button>
              {wantNotTonight ? (
                <span className="hint want-filter-hint">
                  已藏起在今晚里的想吃
                </span>
              ) : null}
            </div>
            <div className="want-sort-row" role="group" aria-label="想吃排序">
              <span className="want-sort-label">排序</span>
              <div className="segmented want-sort-segmented">
                {(
                  [
                    ["recent", "最近"],
                    ["custom", "自定义"],
                    ["category", "分类"],
                    ["likes", "赞"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={wantSort === id ? "seg on" : "seg"}
                    aria-pressed={wantSort === id}
                    onClick={() => {
                      setWantSort(id);
                      saveWantSort(id);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="want-to-tonight">
              <button
                type="button"
                className="btn-secondary"
                disabled={wantListForAdd.length === 0}
                title={
                  wantListForAdd.length === 0
                    ? "没有可加入的想吃"
                    : wantNotTonight
                      ? "把当前「未进今晚」列表全部加入"
                      : "把当前想吃列表里未在今晚的菜全部加入"
                }
                onClick={() => {
                  if (!oncePrimary("want-add-all")) return;
                  addWantsToTonight();
                }}
              >
                全部加入今晚
                {wantListForAdd.length > 0
                  ? `（${wantListForAdd.length}）`
                  : ""}
              </button>
              <button
                type="button"
                className={wantSelect ? "btn-ghost is-on" : "btn-ghost"}
                aria-pressed={wantSelect}
                onClick={() => {
                  setWantSelect((v) => !v);
                  setWantPicked([]);
                  hapticTap();
                }}
              >
                {wantSelect ? "完成选择" : "多选"}
              </button>
              {wantSelect && wantPicked.length > 0 ? (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      if (!oncePrimary("want-add-picked")) return;

                      const { added, skipped } = addDishesToMenu(wantPicked);
                      if (added === 0) {
                        toast(
                          skipped > 0 ? "选中的都已在今晚" : "没有可加入的菜",
                          {
                            ms: 5200,
                            ...(skipped > 0
                              ? {
                                  actionLabel: "去看看",
                                  undo: () => navigate("/tonight"),
                                }
                              : {}),
                          },
                        );
                      } else {
                        const bits = [`已把 ${added} 道想吃加入今晚`];
                        if (skipped) bits.push(`跳过 ${skipped} 道`);
                        toast(bits.join(" · "));
                      }
                      setWantPicked([]);
                      setWantSelect(false);
                      hapticTap();
                    }}
                  >
                    加入今晚（{wantPicked.length}）
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      if (!oncePrimary("want-remove-picked")) return;
                      const ids = wantPicked.slice();
                      const snap = removeHearts(ids);
                      setWantPicked([]);
                      setWantSelect(false);
                      hapticTap();
                      if (!snap) {
                        toast("选中的已不在想吃里");
                        return;
                      }
                      toast(`已从想吃移除 ${ids.length} 道`, {
                        ms: 7000,
                        undo: () => {
                          const ok = restoreHearts(snap.hearts, snap.undoToken);
                          toast(ok ? "已恢复想吃列表" : "撤销已失效");
                        },
                      });
                    }}
                  >
                    从想吃移除（{wantPicked.length}）
                  </button>
                </>
              ) : null}
            </div>
            {hearts.length > 8 && (
              <label className="search">
                <SearchIcon />
                <input
                  value={heartQuery}
                  onChange={(event) => setHeartQuery(event.target.value)}
                  placeholder="在想吃里搜菜名"
                  enterKeyHint="search"
                  aria-label="筛选想吃"
                />
              </label>
            )}
            {wantCanReorder ? (
              <ul
                className="want-reorder-list"
                aria-label="想吃列表，可拖动或上移下移排序"
              >
                {hearts.map((dish, index) => {
                  if (!dish) return null;
                  return (
                    <li
                      key={dish.id}
                      className={[
                        "want-reorder-row",
                        wantDrag === index ? "is-dragging" : "",
                        wantOver === index ? "is-over" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      draggable
                      onDragStart={onWantDragStart(index)}
                      onDragOver={onWantDragOver(index)}
                      onDrop={onWantDrop(index)}
                      onDragEnd={onWantDragEnd}
                    >
                      <button
                        type="button"
                        className="drag-handle"
                        aria-label={`拖动调整「${dish.name}」顺序`}
                        title="按住拖动，或用右侧↑↓排序"
                        onClick={(e) => e.preventDefault()}
                      >
                        <span className="drag-grip" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                      </button>
                      <Link
                        className="want-reorder-name"
                        to={`/d/${encodeURIComponent(dish.id)}`}
                        title={dish.name}
                      >
                        {dish.name}
                      </Link>
                      <div className="want-reorder-actions">
                        <button
                          type="button"
                          className="icon-btn move-btn"
                          aria-label={`上移「${dish.name}」`}
                          disabled={index === 0}
                          onClick={() => {
                            moveHeart(dish.id, -1);
                            if (wantSort === "recent") {
                              setWantSort("custom");
                              saveWantSort("custom");
                            }
                            hapticTap();
                          }}
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          className="icon-btn move-btn"
                          aria-label={`下移「${dish.name}」`}
                          disabled={index >= hearts.length - 1}
                          onClick={() => {
                            moveHeart(dish.id, 1);
                            if (wantSort === "recent") {
                              setWantSort("custom");
                              saveWantSort("custom");
                            }
                            hapticTap();
                          }}
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button
                          type="button"
                          className="want-chip-add"
                          aria-label={`把「${dish.name}」加入今晚`}
                          onClick={() => {
                            const { added } = addDishesToMenu([dish.id]);
                            if (added) {
                              toast(`「${dish.name}」已加入今晚`);
                            } else {
                              toast("已在今晚", {
                                ms: 5200,
                                actionLabel: "去看看",
                                undo: () => navigate("/tonight"),
                              });
                            }
                            hapticTap();
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="want-chip-remove"
                          aria-label={`取消想吃「${dish.name}」`}
                          onClick={() => {
                            const snap = removeHeart(dish.id);
                            hapticTap();
                            if (!snap) return;
                            toast(`已取消想吃「${dish.name}」`, {
                              ms: 7000,
                              undo: () => {
                                const ok = insertHeartAt(
                                  dish.id,
                                  snap.index,
                                  snap.undoToken,
                                );
                                toast(
                                  ok
                                    ? `已恢复想吃「${dish.name}」`
                                    : "撤销已失效",
                                );
                              },
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="chips-fade" data-chips="hearts">
                <div
                  className={
                    wantSelect
                      ? "chips want-chips is-selecting"
                      : "chips want-chips"
                  }
                >
                  {(heartQuery.trim()
                    ? hearts.filter(
                        (dish) =>
                          dish &&
                          dish.name
                            .toLowerCase()
                            .includes(heartQuery.trim().toLowerCase()),
                      )
                    : hearts
                  )
                    .slice(0, heartQuery.trim() ? 40 : 24)
                    .map((dish) => {
                      if (!dish) return null;
                      const picked = wantPicked.includes(dish.id);
                      if (wantSelect) {
                        return (
                          <button
                            key={dish.id}
                            type="button"
                            className={
                              picked ? "chip on want-chip" : "chip want-chip"
                            }
                            aria-pressed={picked}
                            title={dish.name}
                            onClick={() => {
                              setWantPicked((prev) =>
                                prev.includes(dish.id)
                                  ? prev.filter((id) => id !== dish.id)
                                  : [...prev, dish.id],
                              );
                              hapticTap();
                            }}
                          >
                            {picked ? "✓ " : ""}
                            <span className="want-chip-label">{dish.name}</span>
                          </button>
                        );
                      }
                      return (
                        <span key={dish.id} className="want-chip-wrap">
                          <Link
                            className="chip want-chip"
                            to={`/d/${encodeURIComponent(dish.id)}`}
                            title={dish.name}
                          >
                            <span className="want-chip-label">{dish.name}</span>
                          </Link>
                          <button
                            type="button"
                            className="want-chip-add"
                            aria-label={`把「${dish.name}」加入今晚`}
                            title="加入今晚"
                            onClick={() => {
                              const { added } = addDishesToMenu([dish.id]);
                              if (added) {
                                toast(`「${dish.name}」已加入今晚`);
                              } else {
                                toast("已在今晚", {
                                  ms: 5200,
                                  actionLabel: "去看看",
                                  undo: () => navigate("/tonight"),
                                });
                              }
                              hapticTap();
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="want-chip-remove"
                            aria-label={`取消想吃「${dish.name}」`}
                            title="取消想吃"
                            onClick={() => {
                              const snap = removeHeart(dish.id);
                              hapticTap();
                              if (!snap) return;
                              toast(`已取消想吃「${dish.name}」`, {
                                ms: 7000,
                                undo: () => {
                                  const ok = insertHeartAt(
                                    dish.id,
                                    snap.index,
                                    snap.undoToken,
                                  );
                                  toast(
                                    ok
                                      ? `已恢复想吃「${dish.name}」`
                                      : "撤销已失效",
                                  );
                                },
                              });
                            }}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
            {wantCanReorder ? (
              <p className="hint want-reorder-hint">
                拖动手柄或点 ↑↓ 调整顺序；顺序会写入想吃并同步给对方。
              </p>
            ) : null}
            {!wantCanReorder && !heartQuery.trim() && hearts.length > 24 && (
              <p className="hint">
                还有 {hearts.length - 24} 道，搜一下菜名就能找到。
              </p>
            )}
            {(wantNotTonight || heartQuery.trim()) &&
            wantListForAdd.length === 0 ? (
              <div className="empty want-filter-empty" role="status">
                <strong>
                  {heartQuery.trim()
                    ? wantNotTonight
                      ? `「未进今晚」里没有「${heartQuery.trim()}」`
                      : `想吃里没有「${heartQuery.trim()}」`
                    : "想吃的都已在今晚了"}
                </strong>
                <p>清掉筛选就能看到列表；想吃本身不会丢。</p>
                <div className="empty-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      if (wantNotTonight) {
                        setWantNotTonight(false);
                        saveWantNotTonight(false);
                      }
                      if (heartQuery.trim()) setHeartQuery("");
                      hapticTap();
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
      <section className="panel couple-panel">
        <h2>两人同步</h2>
        <p className="hint">
          默认记录仅保存在当前浏览器。只有你主动配对或导入同步包时才会共享。知道房间号的人可以加入，请只发给信任的人；共用同一台设备和浏览器的人也会看到本机记录。
        </p>
        <p className="hint couple-lead">
          <strong>创建</strong> → 发 8 位房间号 → 对方<strong>加入</strong> →
          改完点<strong>立即同步</strong>。
          今晚菜单、想吃、账本、几菜几汤与皮肤会推给对方；采购勾选、临时项与步骤勾选只留本机。同时改时修订较新的字段按条目合并。连不上就用下方同步包。
        </p>

        <label className="field nick-field">
          <span>我的昵称</span>
          <input
            value={myNick}
            maxLength={8}
            placeholder="比如：小陈（可选）"
            aria-label="我的昵称，会同步给对方看"
            onChange={(event) => {
              const next = sanitizeNick(event.target.value);
              setMyNick(next);
              saveDisplayNick(next);
              setRoom((prev) =>
                prev ? { ...prev, myNick: next || undefined } : prev,
              );
            }}
          />
          <span className="field-hint-inline">
            最多 8 字 · 只记本机并随同步告诉对方，不影响房间号
          </span>
        </label>
        {room?.partnerNick ? (
          <p className="hint partner-nick-line" role="status">
            对方昵称：<strong>{room.partnerNick}</strong>
          </p>
        ) : room ? (
          <p className="hint partner-nick-line">对方还没设昵称 · 同步后可见</p>
        ) : null}

        <details className="sync-explainer">
          <summary>哪些内容会同步？</summary>
          <div className="sync-legend" role="group" aria-label="同步范围说明">
            <div className="sync-legend-col is-sync">
              <p className="sync-legend-title">会同步给对方</p>
              <ul>
                <li>想吃列表（含顺序）</li>
                <li>今晚菜单 · 备忘</li>
                <li>我们的账本</li>
                <li>几菜几汤搭配</li>
                <li>皮肤主题</li>
              </ul>
            </div>
            <div className="sync-legend-col is-local">
              <p className="sync-legend-title">只留在这台机</p>
              <ul>
                <li>采购勾选 · 食材/步骤勾选</li>
                <li>最近看过 · 搜索历史</li>
                <li>列表疏密度 · 触感等偏好</li>
                <li>同步活动日志</li>
              </ul>
            </div>
          </div>
        </details>

        {room ? (
          <>
            <div className="room-card">
              <div className="room-card-top">
                <div className="room-code-block">
                  <p className="eyebrow">房间号</p>
                  <p
                    className="room-code room-code-lg"
                    aria-label={`房间号 ${room.code}`}
                  >
                    {room.code}
                  </p>
                  <div className="room-code-actions">
                    <button
                      type="button"
                      className="btn-primary room-copy-btn"
                      onClick={() => void copyRoom()}
                    >
                      复制房间号
                    </button>
                    <button
                      type="button"
                      className="btn-secondary room-share-btn"
                      onClick={() => void shareInvite()}
                    >
                      分享邀请
                    </button>
                  </div>
                </div>
                <div
                  className={
                    status.connected
                      ? "room-status on"
                      : status.peerReady
                        ? "room-status wait"
                        : "room-status off"
                  }
                  role="status"
                >
                  <span className="room-status-dot" aria-hidden="true" />
                  <span className="room-status-label">
                    {status.connected
                      ? "已连上对方"
                      : status.peerReady
                        ? "等待对方"
                        : "未连线"}
                  </span>
                </div>
              </div>
              <div className="room-sync-facts" role="status">
                <p className="room-sync-last">
                  <span className="room-sync-k">上次云端保存</span>
                  <strong>{formatSyncTime(room.lastCloudSavedAt)}</strong>
                  <span className="room-sync-tz">上海时区</span>
                </p>
                <p className="hint room-meta">
                  {room.role === "host"
                    ? "你是房主"
                    : status.connected || room.cloudProtocol === 2
                      ? "已找到房间"
                      : "正在查找对方"}
                  {status.connected
                    ? " · 对方在线"
                    : status.peerReady
                      ? " · 等待对方连上"
                      : " · 未连线"}
                  {status.cloudOk ? " · 云端可用" : ""}
                </p>
              </div>
              <p className="hint room-status-msg">{status.message}</p>
              {room.lastError && (
                <p className="hint danger">{room.lastError}</p>
              )}
              {!status.connected ? (
                <p className="hint pair-fail-hint" role="status">
                  {/占用|失败|离线|断开|问题/.test(status.message)
                    ? status.message
                    : status.peerReady
                      ? "对方还没进来，可重试连线或发同步包"
                      : "还没连上，可重试连线"}
                </p>
              ) : null}
              <div className="row-btns wrap">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void copyInvite()}
                >
                  复制邀请文案
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => {
                    if (!oncePrimary("sync-now")) return;
                    void syncNow();
                  }}
                >
                  立即同步
                </button>
                {!status.connected ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={retryPair}
                  >
                    重试连线
                  </button>
                ) : null}
                <button type="button" className="btn-ghost" onClick={leaveRoom}>
                  退出房间
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="row-btns wrap">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void createRoom()}
            >
              创建房间并生成号码
            </button>
          </div>
        )}

        {!room && (
          <form
            className="join-row"
            onSubmit={(event) => {
              event.preventDefault();
              void joinRoom();
            }}
          >
            <label className="field">
              <span>有房间号？加入</span>
              <input
                ref={joinInputRef}
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(normalizeRoomCode(event.target.value));
                  if (joinError) setJoinError(null);
                }}
                placeholder="8 位房间号"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                maxLength={8}
                aria-label="房间号"
                aria-invalid={joinError ? true : undefined}
                aria-describedby={joinError ? "join-code-error" : undefined}
                className={joinError ? "is-invalid" : undefined}
              />
              {joinError ? (
                <span id="join-code-error" className="field-error" role="alert">
                  {joinError}
                </span>
              ) : (
                <span className="field-hint-inline">8 位字母或数字</span>
              )}
            </label>
            <button type="submit" className="btn-secondary" disabled={busy}>
              加入房间
            </button>
          </form>
        )}
        {!room && /离线|失败/.test(status.message) ? (
          <p className="hint pair-fail-hint" role="status">
            {status.message}
            <button
              type="button"
              className="btn-ghost pair-retry-inline"
              disabled={busy}
              onClick={() => {
                if (joinCode.trim()) void joinRoom();
                else void createRoom();
              }}
            >
              重试
            </button>
          </p>
        ) : null}

        {room ? (
          <div className="sync-log panel-inset" aria-label="同步记录">
            <div className="sync-log-head">
              <h3 className="sync-log-title">同步记录</h3>
              {syncLog.length > 0 ? (
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    clearSyncLog();
                    setSyncLog([]);
                    toast("已清空同步记录");
                  }}
                >
                  清空
                </button>
              ) : null}
            </div>
            {syncLog.length === 0 ? (
              <p className="hint sync-log-empty">
                还没有记录。点「立即同步」或收到对方更新后会出现在这里（只留本机，最多
                10 条）。
              </p>
            ) : (
              <ul className="sync-log-list">
                {syncLog.map((row) => (
                  <li key={row.id} className={`sync-log-item is-${row.kind}`}>
                    <span className="sync-log-kind">
                      {syncLogLabel(row.kind)}
                    </span>
                    <span className="sync-log-detail">{row.detail || "—"}</span>
                    <time
                      className="sync-log-when"
                      dateTime={new Date(row.at).toISOString()}
                    >
                      {formatSyncLogWhen(row.at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="sync-pack">
          <h3>同步包兜底</h3>
          <p className="hint">
            复制发给对方，或下载成文件。对方粘贴后点导入，不依赖网络连线。
          </p>
          <div className="row-btns wrap">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void copyPack()}
            >
              复制同步包
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void sharePack()}
            >
              分享同步包
            </button>
            <button type="button" className="btn-ghost" onClick={downloadPack}>
              下载同步包
            </button>
          </div>
          <label className="field">
            <span>粘贴同步包</span>
            <textarea
              value={pasteDraft}
              onChange={(event) => setPasteDraft(event.target.value)}
              rows={3}
              placeholder="把对方发来的 JTE2:… 贴这里"
              spellCheck={false}
              aria-label="粘贴同步包"
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!pasteDraft.trim()}
            onClick={applyPaste}
          >
            导入同步包
          </button>
        </div>
      </section>

      <Link className="shop-strip" to="/ledger">
        <span>
          <strong>我们的账本</strong>
          <small>
            {state.ledger.length > 0
              ? `${state.ledger.length} 道你们的菜`
              : "还是空白"}
          </small>
        </span>
        <span className="shop-strip-meta">打开</span>
      </Link>

      <section className="panel">
        <details className="settings-details">
          <summary>外观主题</summary>
          <div className="section-head">
            <h2>四套皮肤</h2>
            <button type="button" className="linkish" onClick={openThemes}>
              摊开看
            </button>
          </div>
          <div className="theme-picks theme-picks-described" role="list">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                role="listitem"
                className={
                  state.theme === theme.id
                    ? "theme-pick-card is-on"
                    : "theme-pick-card"
                }
                aria-pressed={state.theme === theme.id}
                onClick={() => setTheme(theme.id)}
              >
                <span className="theme-pick-name">{theme.name}</span>
                <span className="theme-pick-blurb">{theme.hint}</span>
              </button>
            ))}
          </div>
          <label className="theme-pulse-toggle">
            <input
              type="checkbox"
              checked={themePulseOn}
              onChange={(event) => {
                const on = event.target.checked;
                setThemePulseOn(on);
                saveThemePulse(on);
                toast(on ? "换肤时会轻轻闪一下强调色" : "已关闭换肤轻反馈");
              }}
            />
            <span>换肤轻反馈</span>
            <em>默认关 · 切皮肤时顶栏强调色轻闪一下（尊重「减少动态效果」）</em>
          </label>
        </details>
      </section>

      <section className="panel">
        <details className="settings-details">
          <summary>晚餐搭配</summary>
          <div className="section-head">
            <h2>几菜几汤</h2>
            <button type="button" className="linkish" onClick={openMeal}>
              调整
            </button>
          </div>
          <p className="hint">
            现在是：{mealSummary(state.meal)}。随机开饭会按这个摇。
          </p>
        </details>
      </section>

      <section className="panel">
        <details className="settings-details">
          <summary>搜索链接设置</summary>
          <h2>在盒马搜</h2>
          <p className="hint hema-honest-hint">
            没有公开的一键加购接口，我们也不会假装放进购物车。详情/清单上的
            <strong>「在盒马搜」</strong>
            会复制关键词并打开搜索页，顺带试一次淘宝/盒马系唤起；唤不起就用网页，或打开盒马
            App 粘贴。模板里的 {"{q}"} 会做成 URL 编码后的关键词。
          </p>
          <div className="presets">
            {HEMA_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={template === preset.template ? "chip on" : "chip"}
                onClick={() => setTemplate(preset.template)}
                title={preset.note}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <label className="field">
            <span>搜索链接模板</span>
            <input
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              spellCheck={false}
              aria-label="盒马搜索链接模板"
            />
          </label>
          {!template.includes("{q}") && (
            <p className="hint">
              没有 {"{q}"} 的话，按钮只会打开这个地址，食材名仍会复制。
            </p>
          )}
          <div className="row-btns">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (template.trim() && !validHemaTemplate(template.trim())) {
                  toast("请填写有效的 http 或 https 搜索链接");
                  return;
                }
                setHemaTemplate(template.trim() || DEFAULT_HEMA_TEMPLATE);
                toast("搜索链接记住了");
              }}
            >
              记住这个链接
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setTemplate(DEFAULT_HEMA_TEMPLATE);
                setHemaTemplate(DEFAULT_HEMA_TEMPLATE);
              }}
            >
              恢复默认
            </button>
          </div>
        </details>
      </section>

      <section className="panel pref-panel">
        <details className="settings-details">
          <summary>设备偏好</summary>
          <h2>偏好</h2>
          <p className="hint">
            分组可折叠；展开状态只记本机。同步说明见上方房间区。
          </p>

          <div className={"pref-fold" + (prefFeelOpen ? " is-open" : "")}>
            <button
              type="button"
              className="pref-fold-head"
              aria-expanded={prefFeelOpen}
              onClick={() => {
                const next = !prefFeelOpen;
                setPrefFeelOpen(next);
                savePrefFold("feel", next);
              }}
            >
              <span>体验 · 声音</span>
              <em aria-hidden="true">{prefFeelOpen ? "▾" : "▸"}</em>
            </button>
            {prefFeelOpen ? (
              <div className="pref-fold-body">
                <label className="theme-pulse-toggle haptics-toggle">
                  <input
                    type="checkbox"
                    checked={hapticsOn}
                    onChange={(event) => {
                      const on = event.target.checked;
                      setHapticsOn(on);
                      saveHapticsEnabled(on);
                      toast(on ? "已开启触感反馈" : "已关闭触感反馈");
                      if (on) hapticTap();
                    }}
                  />
                  <span>触感反馈</span>
                  <em>
                    默认开 · 总开关：关后点按不震，计时提示音也不响（只记本机）
                  </em>
                </label>
                <label className="theme-pulse-toggle timer-chime-toggle">
                  <input
                    type="checkbox"
                    checked={timerChimeOn}
                    disabled={!hapticsOn}
                    onChange={(event) => {
                      const on = event.target.checked;
                      setTimerChimeOn(on);
                      saveTimerChime(on);
                      toast(on ? "计时结束会响一小声" : "已关闭计时提示音");
                      if (on) playTimerChime();
                    }}
                  />
                  <span>计时提示音</span>
                  <em>
                    {hapticsOn
                      ? "默认开 · 步骤计时到 0 时短提示音（跟随触感总开关）"
                      : "先开「触感反馈」总开关，提示音才会响"}
                  </em>
                </label>
                <label className="theme-pulse-toggle cook-speak-toggle">
                  <input
                    type="checkbox"
                    checked={cookSpeakOn}
                    disabled={!canSpeak()}
                    onChange={(event) => {
                      const on = event.target.checked;
                      setCookSpeakOn(on);
                      saveCookSpeak(on);
                      toast(
                        !canSpeak()
                          ? "这台设备不支持朗读"
                          : on
                            ? "已开启步骤朗读（开做时手动点「读出本步」）"
                            : "已关闭步骤朗读",
                      );
                    }}
                  />
                  <span>步骤朗读</span>
                  <em>
                    {canSpeak()
                      ? "默认关 · 开做时可选读出本步（不自动朗读，只记本机）"
                      : "这台设备不支持语音合成"}
                  </em>
                </label>
              </div>
            ) : null}
          </div>

          <div className={"pref-fold" + (prefLayoutOpen ? " is-open" : "")}>
            <button
              type="button"
              className="pref-fold-head"
              aria-expanded={prefLayoutOpen}
              onClick={() => {
                const next = !prefLayoutOpen;
                setPrefLayoutOpen(next);
                savePrefFold("layout", next);
              }}
            >
              <span>列表 · 桌面</span>
              <em aria-hidden="true">{prefLayoutOpen ? "▾" : "▸"}</em>
            </button>
            {prefLayoutOpen ? (
              <div className="pref-fold-body">
                <p className="hint">
                  紧凑会缩小菜卡封面与间距；列数与间距仅 ≥880
                  宽屏生效。只记本机。
                </p>
                <div
                  className="density-picks"
                  role="group"
                  aria-label="列表疏密"
                >
                  <span className="density-label">列表</span>
                  <div
                    className="segmented density-segmented"
                    role="tablist"
                    aria-label="列表疏密"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={density === "comfort"}
                      className={density === "comfort" ? "seg on" : "seg"}
                      onClick={() => pickDensity("comfort")}
                    >
                      舒适
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={density === "compact"}
                      className={density === "compact" ? "seg on" : "seg"}
                      onClick={() => pickDensity("compact")}
                    >
                      紧凑
                    </button>
                  </div>
                </div>
                <div
                  className="density-picks grid-cols-picks"
                  role="group"
                  aria-label="桌面列数"
                >
                  <span className="density-label">桌面列数</span>
                  <div
                    className="segmented density-segmented"
                    role="tablist"
                    aria-label="菜卡列数"
                  >
                    {(
                      [
                        ["auto", "自动"],
                        ["2", "2 列"],
                        ["3", "3 列"],
                        ["4", "4 列"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={gridCols === id}
                        className={gridCols === id ? "seg on" : "seg"}
                        onClick={() => pickGridCols(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="density-picks grid-gap-picks"
                  role="group"
                  aria-label="桌面卡片间距"
                >
                  <span className="density-label">桌面间距</span>
                  <div
                    className="segmented density-segmented"
                    role="tablist"
                    aria-label="菜卡间距"
                  >
                    {(
                      [
                        ["tight", "紧"],
                        ["standard", "标准"],
                        ["loose", "松"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={gridGap === id}
                        className={gridGap === id ? "seg on" : "seg"}
                        onClick={() => pickGridGap(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </section>

      <section className="panel about">
        <details className="settings-details">
          <summary>备份与关于</summary>
          <h2>关于这本账</h2>
          <p>
            菜名和抖音链接来自{SOURCE}（含村驴 /
            小不点子等公开来源）。热门菜有精修步骤，其余按菜名生成家常做法；菜图用真实视频封面或实拍，不用手绘菜图。
          </p>
          <ul className="about-data-notes">
            <li>
              菜谱与封面：整理自小不点子、村驴等公开菜名 /
              封面，便于浏览与搜索。
            </li>
            <li>
              界面插画：空态、导航、引导等 UI 装饰为 Codex 绘制；菜图本身不是
              Codex。
            </li>
            <li>
              盒马：仅生成搜索关键词 /
              打开搜索页，不是一键加购，也不会读写购物车。
            </li>
          </ul>
          <p>
            账本、今晚菜单、想吃、皮肤、搜索模板和房间号，都存在这台浏览器的
            localStorage 里。
          </p>
          <p className="hint">
            浏览过的菜封面会缓存在本机（与版本包分开），方便离线回看；不会塞进站点上传额度。
          </p>
          <div className="backup-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                downloadLocalBackup();
                toast("已下载本机备份（不含配对密钥）");
              }}
            >
              导出本机备份
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                try {
                  downloadLocalBackup(true);
                  toast("已导出导入前恢复点，可重新导入恢复");
                } catch {
                  toast("还没有可导出的恢复点");
                }
              }}
            >
              导出导入前恢复点
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                try {
                  downloadSyncRecovery();
                  toast("已导出同步前恢复点，可导入找回原菜单");
                } catch {
                  toast("还没有可导出的同步恢复点");
                }
              }}
            >
              导出同步前恢复点
            </button>
            <label className="btn-ghost backup-import-label">
              导入备份
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (file.size > 20 * 1024 * 1024) {
                    toast("备份超过 20 MB，请检查文件");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onerror = () => toast("备份文件读取失败");
                  reader.onload = () => {
                    try {
                      const raw = JSON.parse(String(reader.result || ""));
                      const backup = parseLocalBackup(raw);
                      if (!backup) {
                        toast("不是有效的备份文件");
                        return;
                      }
                      setPendingBackup(backup);
                    } catch {
                      toast("备份读不出来，检查文件");
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
            <p className="hint backup-hint">
              含想吃/今晚/账本/勾选与偏好；不含配对密钥。导入时可选覆盖或合并。
            </p>
          </div>

          {pendingBackup ? (
            <Sheet open title="导入备份" onClose={() => setPendingBackup(null)}>
              <p className="hint">
                不含配对密钥。请选一种方式（会保留导入前恢复点，导入后刷新）：
              </p>
              <ul className="backup-import-rules hint">
                <li>
                  <strong>覆盖本机</strong>
                  ：想吃、今晚、账本、勾选与偏好整包换成备份。
                </li>
                <li>
                  <strong>合并</strong>：想吃/今晚/账本按 id 去重合并（同 id
                  账本留较新）；采购勾选合并；
                  <em>偏好、皮肤、几菜几汤保留本机</em>。
                </li>
              </ul>
              <div className="row-btns wrap">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPendingBackup(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const backup = pendingBackup;
                    if (!backup) return;
                    try {
                      mergeLocalBackup(backup);
                      setPendingBackup(null);
                      toast("已合并备份 · 已保留导入前恢复点");
                      window.setTimeout(() => window.location.reload(), 600);
                    } catch {
                      toast("合并未完成，原数据已保留；请检查文件或存储空间");
                    }
                  }}
                >
                  合并
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const backup = pendingBackup;
                    if (!backup) return;
                    try {
                      applyLocalBackup(backup);
                      setPendingBackup(null);
                      toast("已恢复备份 · 已保留导入前恢复点");
                      window.setTimeout(() => window.location.reload(), 600);
                    } catch {
                      toast("恢复未完成，原数据已保留；请检查文件或存储空间");
                    }
                  }}
                >
                  覆盖本机
                </button>
              </div>
            </Sheet>
          ) : null}

          <p className="about-version">
            版本 <strong>{APP_VERSION}</strong>
            <span className="about-version-sep">·</span>
            <span className="about-sw" title="离线缓存随构建自动更新">
              SW {SW_CACHE}
            </span>
            {storageLabel ? (
              <>
                <span className="about-version-sep">·</span>
                <span
                  className="about-storage"
                  title="本机 localStorage / 缓存粗估，仅供参考"
                >
                  占用 {storageLabel}
                </span>
              </>
            ) : null}
            <span className="about-version-sep">·</span>
            <a
              className="linkish"
              href={LIVE_URL}
              target="_blank"
              rel="noreferrer"
            >
              线上地址
            </a>
          </p>
          <p>
            想固定到手机：Safari / Chrome
            菜单里选「添加到主屏幕」或「安装应用」即可（已安装时不会再提示）。
          </p>
          <div className="desk-keys-sheet" aria-label="宽屏快捷键">
            <p className="desk-keys-sheet-title">宽屏快捷键</p>
            <table className="desk-keys-table">
              <tbody>
                <tr>
                  <th scope="row">
                    <kbd>/</kbd>
                  </th>
                  <td>聚焦搜索</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>Esc</kbd>
                  </th>
                  <td>关闭面板 / 清空搜索</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>g</kbd> <kbd>h</kbd>
                  </th>
                  <td>回首页</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>g</kbd> <kbd>t</kbd>
                  </th>
                  <td>今晚菜单</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>g</kbd> <kbd>u</kbd>
                  </th>
                  <td>我们</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>g</kbd> <kbd>l</kbd>
                  </th>
                  <td>账本</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>g</kbd> <kbd>s</kbd>
                  </th>
                  <td>采购清单</td>
                </tr>
              </tbody>
            </table>
            <p className="hint desk-keys-note">
              仅 ≥880 宽屏；输入框内不触发。
            </p>
          </div>
          <div className="about-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                replayOnboard();
                hapticTap();
                toast("打开上手引导");
              }}
            >
              再看引导
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}
