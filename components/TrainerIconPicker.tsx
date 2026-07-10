'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TrainerIcon {
  id: number
  file: string
  label: string | null
}

interface Props {
  icons: TrainerIcon[]
  selectedId: number | null
  userId: string
  onSelect: (id: number, file: string) => void
}

const PAGE_SIZE = 48

export default function TrainerIconPicker({ icons, selectedId, userId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return icons
    return icons.filter((ic) =>
      ic.file.toLowerCase().includes(q) || (ic.label ?? '').toLowerCase().includes(q)
    )
  }, [icons, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  async function handleSelect(icon: TrainerIcon) {
    if (icon.id === selectedId) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ trainer_icon_id: icon.id })
      .eq('id', userId)
    onSelect(icon.id, icon.file)
    setSaving(false)
  }

  function handleSearch(v: string) {
    setSearch(v)
    setPage(0)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink">Trainer Avatar</label>
        {saving && <span className="text-xs text-muted">Saving…</span>}
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search trainer…"
        className="w-full bg-paper border border-card-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
      />
      <div className="grid grid-cols-6 gap-1.5">
        {visible.map((ic) => (
          <button
            key={ic.id}
            type="button"
            onClick={() => handleSelect(ic)}
            title={ic.label ?? ic.file}
            className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
              ic.id === selectedId
                ? 'border-signal ring-2 ring-signal/30'
                : 'border-transparent hover:border-card-border'
            }`}
          >
            <img
              src={`/Trainers/${ic.file}`}
              alt={ic.label ?? ''}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs text-ink disabled:text-muted px-3 py-1.5 rounded-lg border border-card-border hover:border-ink/30 disabled:border-card-border transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted font-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-xs text-ink disabled:text-muted px-3 py-1.5 rounded-lg border border-card-border hover:border-ink/30 disabled:border-card-border transition-colors"
          >
            Next
          </button>
        </div>
      )}
      {filtered.length === 0 && (
        <p className="text-xs text-muted text-center py-4">No trainers match your search.</p>
      )}
    </div>
  )
}
