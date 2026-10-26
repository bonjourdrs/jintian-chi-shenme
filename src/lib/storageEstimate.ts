/** Rough localStorage (+ optional Cache Storage) usage for About. */
export type StorageEstimate = {
  /** localStorage bytes (UTF-16 approx) */
  localBytes: number;
  /** Cache Storage bytes if available */
  cacheBytes: number | null;
};

function lsBytes(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) ?? "";
      /* UTF-16 code units × 2 — coarse browser estimate */
      total += (key.length + val.length) * 2;
    }
    return total;
  } catch {
    return -1;
  }
}

async function cacheBytes(): Promise<number | null> {
  try {
    if (!("caches" in window) || !caches.keys) return null;
    const keys = await caches.keys();
    let total = 0;
    for (const name of keys) {
      const cache = await caches.open(name);
      const reqs = await cache.keys();
      for (const req of reqs) {
        const res = await cache.match(req);
        if (!res) continue;
        const clone = res.clone();
        const buf = await clone.arrayBuffer().catch(() => null);
        if (buf) total += buf.byteLength;
        else {
          const len = Number(res.headers.get("content-length"));
          if (Number.isFinite(len) && len > 0) total += len;
        }
      }
    }
    return total;
  } catch {
    return null;
  }
}

export function formatStorageKb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `约 ${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `约 ${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `约 ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export async function estimateLocalUsage(): Promise<StorageEstimate | null> {
  const localBytes = lsBytes();
  if (localBytes < 0) return null;
  const cache = await cacheBytes();
  return { localBytes, cacheBytes: cache };
}
