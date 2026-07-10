'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkAchievements } from '@/lib/checkAchievements'

interface Props {
  userId: string
  machineId: string
  initialFavorited: boolean
  onChange?: (favorited: boolean) => void
}

export default function FavoriteToggle({ userId, machineId, initialFavorited, onChange }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function toggle() {
    if (busy) return
    setBusy(true)
    const supabase = createClient()
    const next = !favorited
    if (next) {
      await supabase.from('machine_favorites').insert({ user_id: userId, machine_id: machineId })
      // Award any favorite-based badges now that a new favorite was added.
      checkAchievements(userId).then((earned) => {
        if (earned.length > 0) {
          const msg = earned.length === 1 ? `🏅 Badge earned: ${earned[0]}!` : `🏅 ${earned.length} new badges earned!`
          showToast(msg)
        }
      }).catch(() => {})
    } else {
      await supabase.from('machine_favorites').delete().eq('user_id', userId).eq('machine_id', machineId)
    }
    setFavorited(next)
    onChange?.(next)
    setBusy(false)
  }

  return (
    <>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ok text-white">
          {toast}
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={favorited}
        aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
        className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors disabled:opacity-50 ${
          favorited ? 'bg-signal/10 border-signal/40 text-signal' : 'border-card-border text-muted hover:text-ink hover:border-ink/30'
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      </button>
    </>
  )
}
