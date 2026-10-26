import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BackIcon } from "../components/Icons.tsx";
import { ThemeButton } from "../components/ThemeSheet.tsx";
import { compressImage } from "../lib/image.ts";
import { oncePrimary } from "../lib/primaryGuard.ts";
import { useTitle } from "../lib/useTitle.ts";
import { useApp } from "../state/store.tsx";
import type { LedgerEntry } from "../types.ts";

export function LedgerEditPage({ creating = false }: { creating?: boolean }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, saveLedger, deleteLedger, restoreLedger, addLedgerToMenu, toast } = useApp();
  const existing = creating ? undefined : state.ledger.find((entry) => entry.id === id);
  const missing = !creating && !existing;

  const [name, setName] = useState(existing?.name ?? params.get("name") ?? "");
  const [ingredients, setIngredients] = useState(existing?.ingredients ?? params.get("ingredients") ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [image, setImage] = useState<string | undefined>(existing?.image);
  const [confirm, setConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const ingredientsRef = useRef<HTMLTextAreaElement>(null);
  useTitle(creating ? "写一道菜" : existing?.name ?? "账本");

  useEffect(() => {
    if (!confirm) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  const build = (opts?: { requireIngredients?: boolean }): LedgerEntry | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("请填写菜名");
      setIngredientsError(null);
      nameRef.current?.focus();
      return null;
    }
    setNameError(null);
    if (opts?.requireIngredients && !ingredients.trim()) {
      setIngredientsError("先写一行食材，不然清单是空的");
      ingredientsRef.current?.focus();
      return null;
    }
    setIngredientsError(null);
    const now = Date.now();
    return {
      id: existing?.id ?? crypto.randomUUID(),
      name: trimmed,
      notes: notes.trim(),
      ingredients: ingredients.trim(),
      image,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const onSave = () => {
    if (!oncePrimary("ledger-save")) return;
    const entry = build();
    if (!entry) return;
    saveLedger(entry);
    setDirty(false);
    setConfirm(false);
    toast(creating ? "记在账本上了" : "改好了");
    if (creating) {
      /* Stay in context: land on the new entry editor, not a cold list jump */
      navigate(`/ledger/${encodeURIComponent(entry.id)}`, { replace: true });
    }
  };

  const onCancel = () => {
    if (dirty) {
      toast("未保存的改动已丢弃");
    }
    navigate("/ledger");
  };

  const cookTonight = () => {
    if (!oncePrimary("ledger-cook")) return;
    const entry = build({ requireIngredients: true });
    if (!entry) return;
    saveLedger(entry);
    addLedgerToMenu(entry.id);
    setDirty(false);
    toast("记下来了，并放进今晚");
    navigate("/tonight");
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("请选一张图片");
      return;
    }
    try {
      const data = await compressImage(file);
      setImage(data);
      setDirty(true);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      toast(reason === "large" ? "这张图还是太大，换一张小一点的" : "这张图读不了");
    }
  };

  if (missing) {
    return (
      <div className="page">
        <div className="empty">
          <strong>这篇不在账本里</strong>
          <p>可能是链接过期了，回账本再找找。</p>
          <div className="empty-actions">
            <Link className="btn-primary" to="/ledger">
              回账本
            </Link>
            <Link className="btn-ghost" to="/">
              回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page ledger-edit-page">
      <header className="subhead">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="返回账本">
          <BackIcon />
        </button>
        <div>
          <h1>{creating ? "新的一页" : "改一改"}</h1>
          <p className="crumb">{creating ? "写进你们的账本" : existing?.name}</p>
        </div>
        <ThemeButton />
      </header>

      <form
        className="ledger-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="field">
          <span>
            菜名 <em className="field-req">必填</em>
          </span>
          <input
            ref={nameRef}
            className={nameError ? "title-input is-invalid" : "title-input"}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
              if (nameError) setNameError(null);
            }}
            placeholder="比如：番茄炒蛋"
            autoComplete="off"
            required
            aria-required="true"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "ledger-name-error" : undefined}
          />
          {nameError ? (
            <span id="ledger-name-error" className="field-error" role="alert">
              {nameError}
            </span>
          ) : null}
        </label>
        <label className="field">
          <span>
            食材 <em className="field-hint">一行一样，可选</em>
          </span>
          <textarea
            ref={ingredientsRef}
            rows={6}
            className={ingredientsError ? "is-invalid" : undefined}
            value={ingredients}
            onChange={(event) => {
              setIngredients(event.target.value);
              setDirty(true);
              if (ingredientsError) setIngredientsError(null);
            }}
            placeholder={"番茄 2 个\n鸡蛋 3 个\n小葱 2 根"}
            aria-invalid={ingredientsError ? true : undefined}
            aria-describedby={ingredientsError ? "ledger-ing-error" : undefined}
          />
          {ingredientsError ? (
            <span id="ledger-ing-error" className="field-error" role="alert">
              {ingredientsError}
            </span>
          ) : null}
        </label>
        <label className="field">
          <span>
            笔记 <em className="field-hint">可选</em>
          </span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setDirty(true);
            }}
            placeholder="谁爱吃、上次翻车在哪、盐要少放……"
          />
        </label>
        <div className="field">
          <span>
            照片 <em className="field-hint">可选 · 只存本机</em>
          </span>
          <div className="photo-box">
            {image && <img src={image} alt="" />}
            <label className="btn-ghost">
              {image ? "换一张" : "添一张照片"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  void onPick(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {image && (
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setImage(undefined);
                  setDirty(true);
                }}
              >
                拿掉照片
              </button>
            )}
          </div>
        </div>

        <div className="stack ledger-edit-actions">
          <button type="submit" className="btn-primary block">
            保存
          </button>
          <button type="button" className="btn-secondary block" onClick={cookTonight}>
            保存并放进今晚
          </button>
          <button type="button" className="btn-ghost block" onClick={onCancel}>
            取消
          </button>
        </div>
      </form>

      {!creating && existing && (
        <div className={confirm ? "confirm-box is-open" : "confirm-box"}>
          {confirm ? (
            <>
              <p>
                从账本撕掉「{existing.name}」？这台设备上就没有了。
                <span className="confirm-hint">按 Esc 可取消</span>
              </p>
              <div className="row-btns">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    const snap = deleteLedger(existing.id);
                    if (!snap) {
                      toast("这页已经不在账本里了");
                      navigate("/ledger");
                      return;
                    }
                    toast("撕掉了", {
                      ms: 7000,
                      undo: () => {
                        const ok = restoreLedger(snap.entry, snap.wasInMenu, snap.undoToken);
                        toast(ok ? `已恢复「${snap.entry.name}」` : "撤销已失效");
                      },
                    });
                    navigate("/ledger");
                  }}
                >
                  确认撕掉
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
                  留下
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="linkish danger-link" onClick={() => setConfirm(true)}>
              撕掉这页
            </button>
          )}
        </div>
      )}
    </div>
  );
}
