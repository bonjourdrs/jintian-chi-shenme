import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatSyncRelative, formatSyncTime, loadRoomMeta, ROOM_KEY, type CoupleRoomMeta } from "../lib/coupleSync.ts";
import { loadDisplayNick, sanitizeNick } from "../lib/nicks.ts";

type Props = {
  /** Compact inline for tonight/home strips */
  compact?: boolean;
  className?: string;
};

type ConflictFlash = { kept: "local" | "remote"; at: number } | null;
type SyncPhase = "idle" | "pending" | "syncing";

function readMeta(): CoupleRoomMeta | null {
  try {
    return loadRoomMeta();
  } catch {
    return null;
  }
}

/** Paired rooms always show a short pair label; never invent nicks when unpaired. */
function nickPair(room: CoupleRoomMeta): string {
  const me = sanitizeNick(loadDisplayNick() || room.myNick || "") || "我";
  const partner = sanitizeNick(room.partnerNick || "") || "TA";
  return `${me} · ${partner}`;
}

export function SyncChip({ compact = false, className }: Props) {
  const [room, setRoom] = useState<CoupleRoomMeta | null>(() => readMeta());
  const [flash, setFlash] = useState<ConflictFlash>(null);
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const lastTap = useRef(0);

  useEffect(() => {
    const refresh = () => setRoom(readMeta());
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === ROOM_KEY || event.key.startsWith("jte.")) refresh();
    };
    const onRoom = () => refresh();
    const onConflict = (event: Event) => {
      const detail = (event as CustomEvent<{ kept?: "local" | "remote" }>).detail;
      const kept = detail?.kept === "local" ? "local" : "remote";
      setFlash({ kept, at: Date.now() });
      refresh();
    };
    const onSyncStatus = (event: Event) => {
      const next = (event as CustomEvent<{ phase?: SyncPhase }>).detail?.phase;
      if (next === "pending" || next === "syncing" || next === "idle") setPhase(next);
    };
    window.addEventListener("jte-room-changed", onRoom as EventListener);
    window.addEventListener("jte-sync-conflict", onConflict as EventListener);
    window.addEventListener("jte-sync-status", onSyncStatus as EventListener);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    const id = window.setInterval(refresh, 8000);
    const tick = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("jte-room-changed", onRoom as EventListener);
      window.removeEventListener("jte-sync-conflict", onConflict as EventListener);
      window.removeEventListener("jte-sync-status", onSyncStatus as EventListener);
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const requestSyncNow = () => {
    const now = Date.now();
    if (now - lastTap.current < 1200) return;
    lastTap.current = now;
    try {
      window.dispatchEvent(new CustomEvent("jte-sync-now"));
    } catch {
      /* ignore */
    }
  };

  if (!room) {
    return (
      <Link
        className={["sync-chip is-local", compact ? "is-compact" : "", className].filter(Boolean).join(" ")}
        to="/us"
        title="今晚菜单只在这台机；去「我们」配对后可同步给对方"
      >
        <span className="sync-chip-dot" aria-hidden="true" />
        <span className="sync-chip-label">仅本机</span>
        {!compact ? <span className="sync-chip-meta">去配对</span> : null}
      </Link>
    );
  }

  const syncing = phase === "pending" || phase === "syncing";
  const synced = Boolean(room.lastSyncedAt);
  const whenAbs = formatSyncTime(room.lastSyncedAt);
  const whenRel = synced ? formatSyncRelative(room.lastSyncedAt, nowTick) : null;
  const names = nickPair(room);
  const flashLabel =
    flash?.kept === "local" ? "已留本机" : flash?.kept === "remote" ? "已用对方" : null;
  const label = flashLabel ?? (syncing ? "同步中…" : synced ? "已同步给对方" : "已配对 · 待同步");

  return (
    <div
      className={[
        "sync-chip has-sync-action",
        syncing ? "is-syncing" : synced ? "is-synced" : "is-paired",
        flash ? (flash.kept === "local" ? "is-kept-local" : "is-kept-remote") : "",
        compact ? "is-compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={
        flashLabel
          ? flash?.kept === "local"
            ? "冲突时保留了本机较新的菜单"
            : "已用对方较新的菜单覆盖本机"
          : syncing
            ? "正在把今晚菜单推给对方…"
            : synced
              ? `已与房间 ${room.code} 同步过 · 上次 ${whenAbs}${names ? ` · ${names}` : ""}`
              : `已进房间 ${room.code}，可立即同步`
      }
    >
      <Link className="sync-chip-main" to="/us">
        <span className="sync-chip-dot" aria-hidden="true" />
        <span className="sync-chip-label">{label}</span>
        {!compact ? (
          <span className="sync-chip-meta">
            <span className="sync-chip-nicks">{names}</span>
            {" · "}
            {room.code}
            {synced && !flashLabel && !syncing && whenRel ? ` · ${whenRel}` : ""}
          </span>
        ) : (
          <span className="sync-chip-aside">
            <span className="sync-chip-meta is-nicks">{names}</span>
            {synced && !flashLabel && !syncing && whenRel ? (
              <span className="sync-chip-rel" title={whenAbs || undefined}>
                {whenRel}
              </span>
            ) : null}
          </span>
        )}
      </Link>
      <button
        type="button"
        className="sync-chip-now"
        disabled={syncing}
        aria-busy={syncing}
        title={syncing ? "同步进行中" : "跳过等待，立刻推/拉一次"}
        onClick={requestSyncNow}
      >
        {syncing ? "同步中" : "立即同步"}
      </button>
    </div>
  );
}
