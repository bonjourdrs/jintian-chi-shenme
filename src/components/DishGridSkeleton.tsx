/** Pulsing dish-card placeholders matching 4:3 cover + meta. */
export function DishGridSkeleton({
  count = 8,
  className,
  label = "加载中",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={className ? `dish-grid ${className}` : "dish-grid"}
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="dish-card-skeleton" aria-hidden="true">
          <div className="skel-art" />
          <div className="skel-body">
            <span className="skel-line skel-title" />
            <span className="skel-line skel-meta" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="recent-strip is-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="recent-card-skeleton">
          <span className="skel-art" />
          <span className="skel-line skel-title" />
        </div>
      ))}
    </div>
  );
}
