'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export interface SetItem {
  set_code: string
  set_name: string
  image_url: string
  artCount: number
  description: string | null
}

const DESCRIPTION_MAX = 500

export default function VvmItemsClient({ sets }: { sets: SetItem[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(setCode: string, value: string) {
    setSaving(setCode)
    const supabase = createClient()
    const trimmed = value.trim()
    const { error } = await supabase
      .from('vending_set_info')
      .upsert(
        { set_code: setCode, description: trimmed || null, updated_at: new Date().toISOString() },
        { onConflict: 'set_code' }
      )
    setSaving(null)
    if (error) { showToast('Failed to save.'); return }
    showToast(trimmed ? 'Description saved.' : 'Description cleared.')
    setDrafts((d) => {
      const next = { ...d }
      delete next[setCode]
      return next
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ink text-white">
          {toast}
        </div>
      )}

      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Machine Items</h2>
        <p className="text-xs text-muted leading-snug">
          Shown when a member taps an item in the machine. Raffle ticket
          descriptions live on the{' '}
          <Link href="/admin/raffle" className="text-signal font-medium hover:underline">
            Raffle
          </Link>{' '}
          page.
        </p>
      </div>

      {sets.length === 0 ? (
        <p className="text-sm text-muted">No active packs in the machine.</p>
      ) : (
        <ul className="space-y-2">
          {sets.map((s) => {
            const draft = drafts[s.set_code]
            const value = draft ?? s.description ?? ''
            const dirty = draft !== undefined && draft.trim() !== (s.description ?? '')
            return (
              <li key={s.set_code} className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={s.image_url}
                    alt=""
                    className="w-12 h-16 object-contain rounded bg-paper shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{s.set_name}</p>
                    <p className="font-mono text-[11px] text-muted">
                      {s.set_code} · {s.artCount} wrapper{s.artCount === 1 ? '' : 's'}
                    </p>
                    {!s.description && (
                      <p className="text-[11px] text-muted italic mt-0.5">No description yet</p>
                    )}
                  </div>
                </div>

                <textarea
                  value={value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.set_code]: e.target.value }))}
                  rows={3}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="What a shopper sees when they tap this item…"
                  className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal resize-none placeholder:text-muted"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted">
                    {value.length}/{DESCRIPTION_MAX}
                  </span>
                  {dirty && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setDrafts((d) => {
                          const next = { ...d }
                          delete next[s.set_code]
                          return next
                        })}
                        className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(s.set_code, value)}
                        disabled={saving === s.set_code}
                        className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1 hover:bg-signal/10 transition-colors disabled:opacity-50"
                      >
                        {saving === s.set_code ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
