interface ConditionBadge {
  name: string
  ago: string
}

interface Props {
  minute: number
  success: boolean
  reporter: string
  ago: string
  conditions?: ConditionBadge[]
  isOwn?: boolean
  onDelete?: () => void
}

export default function TimerCard({ minute, success, reporter, ago, conditions, isOwn, onDelete }: Props) {
  return (
    <li className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
            success ? 'bg-ok/10 text-ok' : 'bg-card-border text-muted'
          }`}
        >
          {success ? '✓' : '✗'}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">:{String(minute).padStart(2, '0')}</p>
          <p className="text-xs text-muted truncate">{reporter}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right space-y-0.5">
          <p className="font-mono text-xs text-muted">{ago}</p>
          {conditions?.map((c, i) => (
            <p key={i} className="text-[10px] font-medium text-signal">
              {c.name} · {c.ago}
            </p>
          ))}
        </div>
        {isOwn && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete timer report"
            className="w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-paper transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </li>
  )
}
