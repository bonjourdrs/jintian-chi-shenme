import { useEffect, useState, type ReactNode } from "react";
import { catIcon, dishArt, emptyAsset, kindArt, navAsset, uiAsset, type EmptyKind, type NavAssetName } from "../lib/assets.ts";
import { noteCoverFail, quietCoverRetryLabels } from "../lib/coverFail.ts";
import { hashString, mulberry32 } from "../lib/random.ts";
import { dishKind, dishTones, type Motif } from "../lib/visual.ts";

/** Prefer Codex PNG; on 404 fall back to SVG children. */
function coverInitials(name: string): string {
  const s = name.trim();
  if (!s) return "菜";
  const chars = [...s];
  return chars.slice(0, Math.min(2, chars.length)).join("");
}

function AssetOrFallback({
  src,
  imgClassName,
  fallback,
  skeleton = false,
  /** Soft fail if decode hangs — avoid eternal blur skeleton. */
  loadTimeoutMs = 7000,
  /** First-screen / LCP: eager + high fetch priority. */
  priority = false,
  /** Offscreen covers: native lazy (skipped when priority). */
  lazy = true,
  /** Allow one tap-to-retry on cover fail (no infinite loop). */
  retryable = false,
  /** Dish name for failed-cover glyph (1–2 chars). */
  missLabel,
}: {
  src: string;
  imgClassName?: string;
  fallback: ReactNode;
  skeleton?: boolean;
  loadTimeoutMs?: number;
  priority?: boolean;
  lazy?: boolean;
  retryable?: boolean;
  missLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [retried, setRetried] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setRevealed(false);
    setRetryNonce(0);
    setRetried(false);
  }, [src]);
  useEffect(() => {
    if (!skeleton || failed || loaded) return;
    const id = window.setTimeout(() => {
      setFailed(true);
      noteCoverFail();
    }, loadTimeoutMs);
    return () => window.clearTimeout(id);
  }, [src, skeleton, failed, loaded, loadTimeoutMs, retryNonce]);
  const retryOnce = () => {
    if (!retryable || retried) return;
    setRetried(true);
    setFailed(false);
    setLoaded(false);
    setRevealed(false);
    setRetryNonce((n) => n + 1);
  };
  if (failed) {
    const canRetry = retryable && !retried;
    const quiet = quietCoverRetryLabels();
    return (
      <span
        className={
          canRetry
            ? quiet
              ? "asset-fallback cover-miss is-retryable is-quiet"
              : "asset-fallback cover-miss is-retryable"
            : "asset-fallback cover-miss"
        }
        role={canRetry ? "button" : undefined}
        tabIndex={canRetry ? 0 : undefined}
        aria-label={canRetry ? "封面加载失败，点按重试" : undefined}
        aria-hidden={canRetry ? undefined : true}
        onClick={canRetry ? retryOnce : undefined}
        onKeyDown={
          canRetry
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  retryOnce();
                }
              }
            : undefined
        }
      >
        {fallback}
        {missLabel ? (
          <span className="cover-miss-glyph" aria-hidden="true">
            {coverInitials(missLabel)}
          </span>
        ) : null}
        {canRetry && !quiet ? <em className="cover-miss-retry">点按重试</em> : null}
      </span>
    );
  }

  /* One continuous path: skeleton until sharp. No mid blur / white flash. */
  const phase = revealed ? "is-loaded is-revealed" : "is-loading";
  const eager = priority || !lazy;
  const imgSrc = retryNonce > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${retryNonce}` : src;
  const img = (
    <img
      className={skeleton ? `${imgClassName ?? ""} ${phase}`.trim() : imgClassName}
      src={imgSrc}
      alt=""
      width={800}
      height={600}
      sizes={skeleton ? "(min-width: 880px) 220px, 42vw" : undefined}
      aria-hidden="true"
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => {
        setLoaded(true);
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
          setRevealed(true);
          return;
        }
        /* Reveal on next frames so decode paints under skeleton, then one crossfade */
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setRevealed(true));
        });
      }}
      onError={() => {
        setFailed(true);
        noteCoverFail();
      }}
    />
  );
  if (!skeleton) return img;
  return (
    <span
      className={
        revealed ? "asset-wrap is-ready" : loaded ? "asset-wrap is-fading" : "asset-wrap is-waiting"
      }
    >
      <span
        className={revealed ? "img-skeleton is-done" : "img-skeleton"}
        aria-hidden="true"
      />
      {img}
    </span>
  );
}

const PIP_MAP: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};

function DiePips({ pips, className }: { pips: number; className?: string }) {
  const spots = PIP_MAP[pips] ?? PIP_MAP[5];
  return (
    <span className={className ? `die ${className}` : "die"} aria-hidden="true">
      {spots.map(([row, column]) => (
        <i key={`${row}-${column}`} style={{ gridRow: row + 1, gridColumn: column + 1 }} />
      ))}
    </span>
  );
}

export function Die({ pips, className }: { pips: number; className?: string }) {
  return (
    <AssetOrFallback
      src={uiAsset("die")}
      imgClassName={className ? `die die-img ${className}` : "die die-img"}
      fallback={<DiePips pips={pips} className={className} />}
    />
  );
}

function Plate({ children }: { children: ReactNode }) {
  return (
    <>
      <circle cx="100" cy="108" r="74" className="plate-shadow" />
      <circle cx="100" cy="100" r="72" className="plate" />
      <circle cx="100" cy="100" r="56" className="well" />
      <ellipse cx="74" cy="74" rx="16" ry="7" className="shine" transform="rotate(-28 74 74)" />
      {children}
    </>
  );
}

function DishArtSvg({ name, category }: { name: string; category: string }) {
  const kind = dishKind(name, category);
  const tones = dishTones(name, category);
  const rand = mulberry32(hashString(`${name}:${category}`));
  const primary = tones[0] ?? "gold";
  const secondary = tones[1] ?? "green";
  const blobCount = kind === "soup" ? 5 : kind === "rice" ? 4 : kind === "cold" ? 3 : 8;
  const blobs = Array.from({ length: blobCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / blobCount + rand() * 0.45;
    const radius = 10 + rand() * (kind === "soup" ? 16 : 28);
    return {
      cx: 100 + Math.cos(angle) * radius,
      cy: (kind === "soup" ? 108 : 98) + Math.sin(angle) * radius * 0.78,
      rx: 6 + rand() * (kind === "seafood" ? 7 : 10),
      ry: 4 + rand() * 6,
      rot: Math.round(rand() * 180),
      tone: tones[index % tones.length] ?? "gold",
    };
  });
  const seeds = Array.from({ length: 5 }, (_, index) => {
    const angle = rand() * Math.PI * 2;
    const radius = 18 + rand() * 22;
    return {
      cx: 100 + Math.cos(angle) * radius,
      cy: 100 + Math.sin(angle) * radius * 0.75,
      r: 1.2 + rand() * 1.8,
      tone: index % 2 ? secondary : primary,
    };
  });

  return (
    <svg viewBox="0 0 200 200" className={`dish-art kind-${kind}`} aria-hidden="true">
      <defs>
        <radialGradient id={`plateGlow-${hashString(name) % 97}`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* soft category-tinted mat behind the plate */}
      <ellipse cx="100" cy="118" rx="78" ry="54" className={`tone tone-${primary}`} opacity="0.12" />
      {kind === "soup" ? (
        <>
          <ellipse cx="100" cy="136" rx="72" ry="18" className="plate-shadow" />
          <path className="bowl" d="M38 110 Q100 156 162 110 L150 140 Q100 172 50 140 Z" />
          <ellipse cx="100" cy="110" rx="60" ry="17" className={`broth tone-${primary}`} />
          <ellipse cx="100" cy="108" rx="48" ry="10" fill={`url(#plateGlow-${hashString(name) % 97})`} />
          {blobs.map((blob) => (
            <ellipse
              key={`${blob.cx}-${blob.cy}`}
              cx={blob.cx}
              cy={blob.cy}
              rx={blob.rx * 0.72}
              ry={blob.ry * 0.72}
              className={`tone tone-${blob.tone}`}
              opacity="0.92"
            />
          ))}
          <g className="steam" fill="none" strokeWidth="2" strokeLinecap="round">
            <path d="M76 74 q7 -14 0 -24" />
            <path d="M100 66 q9 -16 0 -28" />
            <path d="M124 76 q7 -12 0 -22" />
          </g>
        </>
      ) : (
        <Plate>
          <circle cx="100" cy="100" r="54" className={`rim-tint tone tone-${primary}`} />
          <ellipse cx="100" cy="96" rx="40" ry="28" fill={`url(#plateGlow-${hashString(name) % 97})`} />
          {kind === "noodle" && (
            <g className="noodle" fill="none" strokeWidth="3.4" strokeLinecap="round">
              <path d="M60 94 q18 16 0 24 t0 18" />
              <path d="M78 84 q20 18 0 26 t0 20" />
              <path d="M98 88 q18 16 0 24 t0 18" />
              <path d="M118 84 q16 18 0 24 t0 20" />
              <path d="M136 96 q14 14 0 20" />
              <circle cx="88" cy="102" r="5" className={`tone tone-${secondary}`} />
              <circle cx="118" cy="110" r="4" className={`tone tone-${primary}`} />
            </g>
          )}
          {kind === "rice" &&
            Array.from({ length: 18 }, (_, index) => {
              const angle = rand() * Math.PI * 2;
              const radius = rand() * 30;
              return (
                <ellipse
                  key={index}
                  cx={100 + Math.cos(angle) * radius}
                  cy={98 + Math.sin(angle) * radius * 0.78}
                  rx="5.2"
                  ry="3.1"
                  className="tone tone-cream"
                  transform={`rotate(${Math.round(rand() * 80)} 100 100)`}
                />
              );
            })}
          {kind === "cold" && (
            <g className="garnish">
              <ellipse cx="84" cy="102" rx="28" ry="9" className="tone tone-green" transform="rotate(-20 84 102)" />
              <ellipse cx="116" cy="94" rx="26" ry="8" className="tone tone-green" transform="rotate(18 116 94)" />
              <ellipse cx="104" cy="116" rx="22" ry="7" className="tone tone-cream" transform="rotate(-8 104 116)" />
              <circle cx="78" cy="98" r="2.2" className={`tone tone-${primary}`} />
              <circle cx="126" cy="108" r="2" className={`tone tone-${secondary}`} />
            </g>
          )}
          {kind === "seafood" && (
            <>
              <path
                className={`tone tone-${primary}`}
                d="M68 110 C86 80 116 80 128 106 C112 116 88 122 68 110 Z"
              />
              <path className="tone tone-orange" d="M110 94 C128 74 152 84 154 110 C136 114 118 116 110 94 Z" />
              <circle cx="120" cy="94" r="1.7" className="eye" />
              <path className="sauce" d="M70 120 q30 10 60 0" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            </>
          )}
          {(kind === "stir" || kind === "rice" || kind === "seafood" || kind === "noodle") &&
            blobs.slice(0, kind === "seafood" ? 4 : kind === "rice" ? 4 : kind === "noodle" ? 3 : 8).map((blob) => (
              <ellipse
                key={`${blob.cx}-${blob.rot}`}
                cx={blob.cx}
                cy={blob.cy}
                rx={blob.rx}
                ry={blob.ry}
                className={`tone tone-${blob.tone}`}
                transform={`rotate(${blob.rot} ${blob.cx} ${blob.cy})`}
              />
            ))}
          {kind === "stir" && (
            <g className="sauce" fill="none" strokeWidth="2.2" strokeLinecap="round" opacity="0.35">
              <path className={`tone tone-${primary}`} d="M70 118 q20 8 40 2 q16 -4 28 6" stroke="currentColor" />
              <path d="M78 86 q12 -8 24 -2" stroke="currentColor" />
            </g>
          )}
          {seeds.map((seed) => (
            <circle key={`${seed.cx}-${seed.cy}`} cx={seed.cx} cy={seed.cy} r={seed.r} className={`tone tone-${seed.tone}`} opacity="0.8" />
          ))}
          {(kind === "noodle" || kind === "rice") && (
            <g className="sticks" fill="none" strokeWidth="3" strokeLinecap="round">
              <path d="M146 56 L186 92" />
              <path d="M156 50 L194 86" />
            </g>
          )}
        </Plate>
      )}
    </svg>
  );
}

export function DishArt({
  name,
  category,
  priority = false,
  lazy = true,
}: {
  name: string;
  category: string;
  /** Home first row / LCP hero covers */
  priority?: boolean;
  lazy?: boolean;
}) {
  const kind = dishKind(name, category);
  const dishSrc = dishArt(name);
  const kindFallback = (
    <AssetOrFallback
      src={kindArt(kind)}
      imgClassName={`dish-art dish-art-img kind-${kind}`}
      fallback={<DishArtSvg name={name} category={category} />}
      priority={priority}
      lazy={lazy}
    />
  );
  if (!dishSrc) {
    return (
      <span className="dish-art-miss-wrap">
        {kindFallback}
        <span className="cover-miss-glyph is-static" aria-hidden="true">
          {coverInitials(name)}
        </span>
      </span>
    );
  }
  // Real dish photo: cover-fill the frame (never Codex dish art).
  return (
    <AssetOrFallback
      src={dishSrc}
      imgClassName={`dish-art dish-art-img is-photo kind-${kind}`}
      fallback={kindFallback}
      skeleton
      priority={priority}
      lazy={lazy}
      retryable
      missLabel={name}
    />
  );
}

const MOTIF_GLYPH: Record<Motif, string> = {
  home: "家",
  meat: "肉",
  sea: "海",
  veg: "素",
  soup: "汤",
  cold: "凉",
  staple: "主",
};

/** Theme-tinted initial tile — used when Codex cat PNG fails (no cracked img). */
function CatGlyph({ motif, label }: { motif: Motif; label?: string }) {
  const ch = (label || MOTIF_GLYPH[motif] || "菜").trim().slice(0, 1) || "菜";
  return (
    <span className={`cat-glyph motif-${motif}`} aria-hidden="true">
      <em>{ch}</em>
    </span>
  );
}

export function CatPaint({ motif, label }: { motif: Motif; label?: string }) {
  return (
    <AssetOrFallback
      src={catIcon(motif)}
      imgClassName={`cat-asset motif-${motif}`}
      fallback={<CatGlyph motif={motif} label={label} />}
      missLabel={label || MOTIF_GLYPH[motif]}
    />
  );
}

const lineProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CatLine({ motif }: { motif: Motif }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {motif === "home" && (
        <>
          <path d="M8 18c2-6 14-6 16 0" {...lineProps} />
          <path d="M8 18h16" {...lineProps} />
          <path d="M24 18h5" {...lineProps} />
          <path d="M14 12c.4-2 .8-3 1.4-3M18 11c.2-2 .4-3 .8-3" {...lineProps} />
        </>
      )}
      {motif === "meat" && (
        <>
          <circle cx="12" cy="12" r="4" {...lineProps} />
          <path d="M15 15c6 2 10 6 12 10" {...lineProps} />
          <path d="M20 22c2 1 4 1 6-1" {...lineProps} />
        </>
      )}
      {motif === "sea" && <path d="M6 18c4-8 10-8 14 0s8 6 8-2" {...lineProps} />}
      {motif === "veg" && (
        <>
          <path d="M16 26c0-8 6-12 10-14-4 6-4 10-2 14" {...lineProps} />
          <path d="M16 26c0-8-6-12-10-14 4 6 4 10 2 14" {...lineProps} />
          <path d="M16 26V10" {...lineProps} />
        </>
      )}
      {motif === "soup" && (
        <>
          <path d="M7 16h18c0 6-4 10-9 10S7 22 7 16z" {...lineProps} />
          <path d="M12 10c.4-2 .6-3 1-3M16 9c.3-2 .5-3 .8-3M20 11c.3-2 .4-3 .7-3" {...lineProps} />
        </>
      )}
      {motif === "cold" && (
        <>
          <ellipse cx="12" cy="16" rx="6" ry="3" {...lineProps} transform="rotate(-20 12 16)" />
          <ellipse cx="20" cy="16" rx="6" ry="3" {...lineProps} transform="rotate(18 20 16)" />
        </>
      )}
      {motif === "staple" && (
        <>
          <path d="M8 15h16c0 6-3.5 10-8 10s-8-4-8-10z" {...lineProps} />
          <path d="M12 15c.6-3 2-5 4-5s3.4 2 4 5" {...lineProps} />
        </>
      )}
    </svg>
  );
}

function CoupleMarkSvg() {
  return (
    <>
      <svg className="couple-cute" viewBox="0 0 68 36">
        <circle cx="20" cy="14" r="7" fill="#f3d2bf" />
        <path d="M13 13c1-7 13-8 14-1" fill="#3a2618" />
        <circle cx="17.5" cy="14" r="0.7" fill="#3a2618" />
        <circle cx="22.5" cy="14" r="0.7" fill="#3a2618" />
        <path d="M18 17.2q2 1.6 4 0" fill="none" stroke="#c47a6a" strokeWidth="0.8" />
        <circle cx="42" cy="14" r="7" fill="#f6d8c4" />
        <path d="M35 13c1-8 14-7 14 0" fill="#5c3828" />
        <circle cx="39.5" cy="14" r="0.7" fill="#3a2618" />
        <circle cx="44.5" cy="14" r="0.7" fill="#3a2618" />
        <path d="M40 17.2q2 1.6 4 0" fill="none" stroke="#c47a6a" strokeWidth="0.8" />
        <path d="M12 28c6-6 14-6 20-2 4-4 12-4 18 2" fill="none" stroke="#3a2618" strokeWidth="1.2" />
        <path d="M54 10c2 2 2 4 0 6-2-2-2-4 0-6z" fill="#e25b45" />
      </svg>
      <svg className="couple-line" viewBox="0 0 68 36">
        <circle cx="18" cy="13" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M12 28c2-6 10-6 12 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="40" cy="13" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M34 28c2-6 10-6 12 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M54 8l1.2 3.2H59l-2.6 2 1 3.2L54 14.6 50.6 16.4l1-3.2-2.6-2h3.6z" fill="currentColor" />
      </svg>
    </>
  );
}

export function CoupleMark() {
  return (
    <span className="couple" aria-hidden="true">
      <AssetOrFallback
        src={uiAsset("couple")}
        imgClassName="couple-asset"
        fallback={<CoupleMarkSvg />}
      />
    </span>
  );
}

export function BasketArt() {
  return (
    <AssetOrFallback
      src={uiAsset("basket")}
      imgClassName="basket basket-asset"
      fallback={
        <svg className="basket" viewBox="0 0 48 36" aria-hidden="true">
      <path d="M8 16h32l-3 14H11z" className="basket-body" />
      <path d="M6 16h36" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18 16c0-6 12-6 12 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="12" r="4" className="tone tone-red" />
      <ellipse cx="30" cy="11" rx="6" ry="3" className="tone tone-green" />
    </svg>
      }
    />
  );
}



/** Soft LQIP reveal for arbitrary cover URLs (ledger own photos, etc.). */
export function FadeCover({ src, className }: { src: string; className?: string }) {
  return (
    <AssetOrFallback
      src={src}
      imgClassName={className ? `${className} dish-art-img is-photo` : "dish-art-img is-photo"}
      skeleton
      fallback={<span className="empty-art-gap" aria-hidden="true" />}
    />
  );
}

/** Codex empty-state art; falls back to empty-plate (also Codex), never CSS geometry. */
export function EmptyArt({ kind = "default", className }: { kind?: EmptyKind; className?: string }) {
  return (
    <span className={className ?? "empty-art"} aria-hidden="true">
      <AssetOrFallback
        src={emptyAsset(kind)}
        imgClassName="empty-art-img"
        skeleton
        fallback={
          <AssetOrFallback
            src={uiAsset("empty-plate")}
            imgClassName="empty-art-img"
            /* no nested skeleton — avoids double LQIP fade */
            fallback={<span className="empty-art-gap" />}
          />
        }
      />
    </span>
  );
}

/** Codex nav mark; SVG stroke only on image error. */
export function NavCodexIcon({
  name,
  fallback,
  className,
}: {
  name: NavAssetName;
  fallback: ReactNode;
  className?: string;
}) {
  return (
    <AssetOrFallback
      src={navAsset(name)}
      imgClassName={className ?? "icon nav-codex"}
      fallback={fallback}
    />
  );
}

/** Desktop ornament / splash brand mark from Codex batch4. */
export function DeskOrnament({ className }: { className?: string }) {
  return (
    <AssetOrFallback
      src={uiAsset("desk-ornament")}
      imgClassName={className ?? "desk-ornament-img"}
      fallback={<span className="desk-ornament-gap" aria-hidden="true" />}
    />
  );
}

export function SplashMark({ className }: { className?: string }) {
  return (
    <AssetOrFallback
      src={uiAsset("splash-mark")}
      imgClassName={className ?? "splash-mark-img"}
      fallback={<span className="splash-mark-gap" aria-hidden="true" />}
    />
  );
}


const ONBOARD_ART = ["onboard-theme", "onboard-find", "onboard-couple"] as const;

export function OnboardStepArt({ step }: { step: number }) {
  const name = ONBOARD_ART[Math.min(Math.max(step, 0), ONBOARD_ART.length - 1)] ?? "onboard-theme";
  return (
    <span className="onboard-art" aria-hidden="true">
      <AssetOrFallback
        src={uiAsset(name)}
        imgClassName="onboard-art-img"
        skeleton
        fallback={<span className="onboard-art-gap" />}
      />
    </span>
  );
}
