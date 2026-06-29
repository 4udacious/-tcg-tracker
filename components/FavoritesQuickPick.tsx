'use client'

export interface FavoriteMachine {
  id: string
  machine_code: string
  venue: string
  nickname: string | null
  address: string | null
}

interface Props {
  favorites: FavoriteMachine[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function FavoritesQuickPick({ favorites, selectedId, onSelect }: Props) {
  if (favorites.length === 0) return null

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink">Favorites</label>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {favorites.map((m) => {
          const active = selectedId === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className={`shrink-0 flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-1.5 text-left transition-colors ${
                active ? 'bg-signal text-white border-signal' : 'bg-card border-card-border text-ink hover:border-ink/30'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                <span className="font-mono">{m.machine_code}</span>
                <span>{m.nickname ?? m.venue}</span>
              </span>
              {m.address && (
                <span className={`font-mono text-[10px] leading-none ${active ? 'text-white/70' : 'text-muted'}`}>
                  {m.address}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
