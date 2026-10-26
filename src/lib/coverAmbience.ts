/** Sample a tiny average color from a same-origin cover for a soft hero scrim. */
export async function sampleCoverAmbience(src: string): Promise<string | null> {
  if (!src) return null;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  } catch {
    /* continue */
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const done = (value: string | null) => resolve(value);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 16;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          done(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] ?? 0;
          if (a < 32) continue;
          r += data[i] ?? 0;
          g += data[i + 1] ?? 0;
          b += data[i + 2] ?? 0;
          n += 1;
        }
        if (n < 8) {
          done(null);
          return;
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        done(`rgb(${r} ${g} ${b})`);
      } catch {
        done(null);
      }
    };
    img.onerror = () => done(null);
    img.src = src;
  });
}
