'use client'

export interface ConditionType {
  id: string
  name: string
}

interface Props {
  conditionTypes: ConditionType[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function ConditionFlags({ conditionTypes, selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink">Condition flags (optional)</label>
      <div className="flex gap-2 flex-wrap">
        {conditionTypes.map((c) => {
          const active = selected.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-ink text-white border-ink' : 'bg-card border-card-border text-ink hover:border-ink/30'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
