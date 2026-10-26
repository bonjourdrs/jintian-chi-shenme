import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "icon"} aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6" {...stroke} />
      <path d="M16 16l4 4" {...stroke} />
    </Svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <Svg className={className ?? "icon sm"}>
      <path d="M9 6l6 6-6 6" {...stroke} />
    </Svg>
  );
}

export function BackIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15 6l-6 6 6 6" {...stroke} />
    </Svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" {...stroke} />
    </Svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 7h11M8 12h11M8 17h11" {...stroke} />
      <path d="M4.5 7h.5M4.5 12h.5M4.5 17h.5" {...stroke} />
    </Svg>
  );
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="9" r="2.2" {...stroke} />
      <circle cx="15.5" cy="9.5" r="2" {...stroke} />
      <path d="M4.5 18c.6-2.4 2.4-3.6 4.5-3.6S13 15.6 13.5 18" {...stroke} />
      <path d="M13 14.6c1.4-.3 2.8.1 3.8 1.2.8.9 1.2 2 1.4 2.8" {...stroke} />
    </Svg>
  );
}

export function HeartIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <Svg className={className ?? "icon sm"}>
      <path
        d="M12 19s-6.2-3.8-6.2-8A3.4 3.4 0 0 1 12 8.2 3.4 3.4 0 0 1 18.2 11c0 4.2-6.2 8-6.2 8z"
        {...stroke}
        fill={filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 7l10 10M17 7L7 17" {...stroke} />
    </Svg>
  );
}
