/** Screen Wake Lock — keep display on during cooking. Silently no-ops if unsupported. */

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export type WakeLockHandle = {
  release: () => Promise<void>;
};

export async function requestCookWakeLock(): Promise<WakeLockHandle | null> {
  const nav = navigator as WakeLockNavigator;
  if (!nav.wakeLock?.request) return null;
  try {
    const sentinel = await nav.wakeLock.request("screen");
    return {
      release: async () => {
        try {
          if (!sentinel.released) await sentinel.release();
        } catch {
          /* already released / unsupported mid-flight */
        }
      },
    };
  } catch {
    return null;
  }
}
