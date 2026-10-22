/** A grey placeholder block, pulsing while the real thing loads. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-ink/10 ${className}`} />
}

/** A page-shaped placeholder: a title bar, then some rows or tiles. */
export function PageSkeleton({ rows = 4, grid = false }: { rows?: number; grid?: boolean }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-full" />
      {grid ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: rows * 3 }, (_, i) => <Skeleton key={i} className="aspect-[2/3]" />)}
        </div>
      ) : (
        Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)
      )}
    </div>
  )
}
