import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  disconnectCouple,
  pushToCloud,
  pushToPeer,
  startCoupleSession,
  cancelSyncRequests,
  findVersionedRoom,
  type CoupleStatus,
} from "../lib/coupleRoom.ts";
import {
  buildSyncPayload,
  applySyncPayload,
  estimateSyncPayloadBytes,
  formatSyncBytes,
  decodeSyncPack,
  encodeSyncPack,
  inviteText,
  loadRoomMeta,
  validateRoomCode,
  randomRoomCode,
  saveRoomMeta,
  menusDiffer,
  type CoupleRoomMeta,
  type SyncPayload,
} from "../lib/coupleSync.ts";
import { copyText } from "../lib/hema.ts";
import { loadDisplayNick, sanitizeNick } from "../lib/nicks.ts";
import { preserveBeforeSync } from "../lib/backup.ts";
import { pushSyncLog } from "../lib/syncLog.ts";
import { isOnline } from "../lib/online.ts";
import { useApp } from "./store.tsx";
const initialStatus: CoupleStatus = {
  connected: false,
  peerReady: false,
  cloudOk: false,
  message: "还没有房间",
};
function phase(value: "idle" | "pending" | "syncing") {
  window.dispatchEvent(
    new CustomEvent("jte-sync-status", { detail: { phase: value } }),
  );
}
function useCoupleController() {
  const { state, toast, importSync } = useApp();
  const [room, rawSetRoom] = useState<CoupleRoomMeta | null>(() =>
    loadRoomMeta(),
  );
  const roomRef = useRef(room),
    stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const setRoom = useCallback(
    (action: SetStateAction<CoupleRoomMeta | null>) => {
      const next =
        typeof action === "function" ? action(roomRef.current) : action;
      roomRef.current = next;
      saveRoomMeta(next);
      rawSetRoom(next);
    },
    [],
  );
  const [joinCode, setJoinCode] = useState(""),
    [joinError, setJoinError] = useState<string | null>(null),
    [pasteDraft, setPasteDraft] = useState("");
  const joinInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<CoupleStatus>(initialStatus),
    [busy, setBusy] = useState(false),
    [leaveConfirm, setLeaveConfirm] = useState(false);
  const inFlight = useRef(false),
    queued = useRef(false),
    requestGeneration = useRef(0),
    runRef = useRef<(manual?: boolean) => Promise<void>>(async () => {});
  const onRemote = useCallback(
    (payload: SyncPayload): boolean => {
      try {
        const next = applySyncPayload(stateRef.current, payload);
        const changed = menusDiffer(stateRef.current, next);
        if (changed) preserveBeforeSync();
        if (JSON.stringify(next) === JSON.stringify(stateRef.current))
          return true;
        if (!importSync(payload)) return false;
        stateRef.current = next;
        const current = roomRef.current;
        const partner =
          payload.coupleNicks && current
            ? sanitizeNick(
                (current.role === "host"
                  ? payload.coupleNicks.guest
                  : payload.coupleNicks.host) || "",
              )
            : "";
        if (partner)
          setRoom((prev) => (prev ? { ...prev, partnerNick: partner } : prev));
        if (changed) {
          toast("已合并对方修改，其他菜和账本记录已保留");
          pushSyncLog("pull", "已按字段合并");
        }
        return true;
      } catch {
        toast("同步内容暂未保存，本机数据已保留");
        return false;
      }
    },
    [importSync, setRoom, toast],
  );
  const bootSession = useCallback(
    (meta: CoupleRoomMeta) => {
      void startCoupleSession(meta, () => stateRef.current, {
        onRemote,
        onStatus: setStatus,
        onSent: (id) =>
          setRoom((prev) =>
            prev && prev.code === meta.code
              ? { ...prev, lastPeerSentId: id }
              : prev,
          ),
        onAcknowledged: (id) =>
          setRoom((prev) =>
            prev && prev.code === meta.code
              ? { ...prev, lastPeerAckId: id, lastPeerAckAt: Date.now() }
              : prev,
          ),
      }).catch(() =>
        setStatus({ ...initialStatus, message: "连线失败，请重试" }),
      );
    },
    [onRemote, setRoom],
  );
  const code = room?.code,
    role = room?.role;
  useEffect(() => {
    requestGeneration.current++;
    queued.current = false;
    const meta = roomRef.current;
    if (meta) bootSession(meta);
    else {
      disconnectCouple();
      setStatus(initialStatus);
    }
    return () => {
      requestGeneration.current++;
      cancelSyncRequests();
      disconnectCouple();
    };
  }, [code, role, bootSession]);
  const syncNow = useCallback(
    async (manual = true) => {
      const meta = roomRef.current;
      if (!meta) return;
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      if (!isOnline()) {
        if (manual) toast("当前离线，修改已保存在本机");
        return;
      }
      inFlight.current = true;
      setBusy(true);
      phase("syncing");
      const generation = requestGeneration.current;
      try {
        const peerSent = pushToPeer(stateRef.current);
        // Static deployments retain peer/pack sync. Legacy mutable cloud bins are read-only.
        const cloud =
          meta.cloudProtocol === 2
            ? await pushToCloud(meta, stateRef.current)
            : null;
        if (generation !== requestGeneration.current) return;
        if (cloud) {
          if (cloud.ok && cloud.payload) onRemote(cloud.payload);
          setRoom((prev) =>
            prev && prev.code === meta.code
              ? {
                  ...prev,
                  cloudProtocol: cloud.meta.cloudProtocol,
                  cloudRevision: cloud.meta.cloudRevision,
                  lastCloudSavedAt: cloud.meta.lastCloudSavedAt,
                  lastError: cloud.meta.lastError,
                }
              : prev,
          );
          setStatus((prev) => ({
            ...prev,
            cloudOk: cloud.ok,
            message: cloud.message,
          }));
          if (manual || !cloud.ok)
            toast(
              cloud.ok
                ? peerSent
                  ? "云端已备份，等待对方确认"
                  : "云端已备份；对方接收状态另行显示"
                : cloud.message,
            );
        } else if (manual)
          toast(
            peerSent
              ? "已发送，等待对方确认"
              : "对方尚未连接，可重试或使用同步包",
          );
        pushSyncLog(
          "push",
          cloud?.message ?? (peerSent ? "已发送，等待确认" : "本机已保存"),
        );
      } catch {
        if (generation === requestGeneration.current)
          toast("同步失败，本机修改已保存");
      } finally {
        inFlight.current = false;
        setBusy(false);
        phase("idle");
        if (queued.current && roomRef.current) {
          queued.current = false;
          window.setTimeout(() => void runRef.current(false), 0);
        }
      }
    },
    [onRemote, setRoom, toast],
  );
  useEffect(() => {
    runRef.current = syncNow;
  }, [syncNow]);
  const contentKey = JSON.stringify(buildSyncPayload(state, 0));
  useEffect(() => {
    if (!code) return;
    phase("pending");
    const timer = window.setTimeout(() => void syncNow(false), 500);
    return () => window.clearTimeout(timer);
  }, [contentKey, code, syncNow]);
  useEffect(() => {
    const manual = () => void runRef.current(true),
      online = () => void runRef.current(false);
    window.addEventListener("jte-sync-now", manual);
    window.addEventListener("jte-reconnect-sync", online);
    return () => {
      window.removeEventListener("jte-sync-now", manual);
      window.removeEventListener("jte-reconnect-sync", online);
    };
  }, []);
  useEffect(() => {
    if (!code) return;
    const tick = () => {
      if (document.visibilityState === "visible") void runRef.current(false);
    };
    const timer = window.setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [code]);
  const cancelSync = () => {
    queued.current = false;
    requestGeneration.current++;
    cancelSyncRequests();
    setBusy(false);
    phase("idle");
    toast("已取消网络同步，本机改动保留");
  };
  const createRoom = async () => {
    if (roomRef.current || inFlight.current) return;
    if (!isOnline()) {
      toast("创建房间需要联网");
      return;
    }
    const generation = requestGeneration.current;
    setBusy(true);
    try {
      const meta: CoupleRoomMeta = {
        code: randomRoomCode(8),
        role: "host",
        myNick: loadDisplayNick() || undefined,
      };
      const cloud = await pushToCloud(meta, stateRef.current);
      if (generation !== requestGeneration.current) return;
      setRoom(cloud.ok ? cloud.meta : meta);
      toast(
        cloud.ok
          ? `房间 ${cloud.meta.code} 已创建，把房间号发给对方`
          : "实时房间正在准备；当前托管未启用版本云服务",
      );
      setStatus((prev) => ({
        ...prev,
        cloudOk: cloud.ok,
        message: cloud.message,
      }));
    } finally {
      setBusy(false);
    }
  };
  const joinRoom = async () => {
    const checked = validateRoomCode(joinCode);
    if (!checked.ok) {
      setJoinError(checked.message);
      joinInputRef.current?.focus();
      return;
    }
    if (roomRef.current || inFlight.current) return;
    if (!isOnline()) {
      toast("查找房间需要联网");
      return;
    }
    const generation = requestGeneration.current;
    setJoinError(null);
    setBusy(true);
    setStatus({ ...initialStatus, message: "正在查找房间…" });
    try {
      const found = await findVersionedRoom(checked.code);
      if (generation !== requestGeneration.current) return;
      const meta: CoupleRoomMeta = found?.meta ?? {
        code: checked.code,
        role: "guest",
      };
      if (found && !onRemote(found.payload)) return;
      setRoom({ ...meta, myNick: loadDisplayNick() || undefined });
      setJoinCode("");
      toast(
        found
          ? "已找到房间并合并菜单，正在连接对方"
          : "正在查找对方，连接确认后才会显示已连接",
      );
    } finally {
      setBusy(false);
    }
  };
  const retryPair = () => {
    if (roomRef.current) bootSession(roomRef.current);
  };
  const leaveRoom = () => setLeaveConfirm(true);
  const confirmLeaveRoom = () => {
    cancelSyncRequests();
    setRoom(null);
    setLeaveConfirm(false);
    toast("已退出连接，本机数据保留");
  };
  const copyRoom = async () => {
    if (roomRef.current)
      toast(
        (await copyText(roomRef.current.code)) ? "房间号已复制" : "复制失败",
      );
  };
  const copyInvite = async () => {
    if (roomRef.current)
      toast(
        (await copyText(inviteText(roomRef.current.code)))
          ? "邀请已复制"
          : "复制失败",
      );
  };
  const share = async (text: string, title: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch {}
    toast((await copyText(text)) ? "已复制，可发给对方" : "复制失败");
  };
  const shareInvite = () =>
    roomRef.current
      ? share(inviteText(roomRef.current.code), "今天吃什么 · 邀请")
      : Promise.resolve();
  const pack = () => encodeSyncPack(buildSyncPayload(stateRef.current));
  const copyPack = async () =>
    toast((await copyText(pack())) ? "同步包已复制" : "复制失败");
  const sharePack = () => share(pack(), "今天吃什么 · 同步包");
  const downloadPack = () => {
    const url = URL.createObjectURL(
      new Blob([pack()], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "今天吃什么-同步包.txt";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const applyPaste = () => {
    const payload = decodeSyncPack(pasteDraft);
    if (!payload) {
      toast("同步包格式无效，请检查文件");
      return;
    }
    if (onRemote(payload)) {
      setPasteDraft("");
      toast(
        `已合并同步包 · ${formatSyncBytes(estimateSyncPayloadBytes(payload))}`,
      );
    }
  };
  return {
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
  };
}
const CoupleContext = createContext<ReturnType<
  typeof useCoupleController
> | null>(null);
export function CoupleProvider({ children }: { children: ReactNode }) {
  const value = useCoupleController();
  return (
    <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>
  );
}
export function useCouple() {
  const value = useContext(CoupleContext);
  if (!value) throw new Error("useCouple 必须放在 CoupleProvider 内");
  return value;
}
