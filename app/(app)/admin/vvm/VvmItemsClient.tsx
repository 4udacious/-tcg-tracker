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
  /** null = unlimited, which is how every set behaved before this existed. */
  totalQuantity: number | null
  claimedQuantity: number
}

const DESCRIPTION_MAX = 500

export default function VvmItemsClient({ sets }: { sets: SetItem[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({})
  const [savingQty, setSavingQty] = useState<string | null>(null)

  async function handleSaveQuantity(setCode: string, raw: string, resetClaimed: boolean) {
    const trimmed = raw.trim()
    const total = trimmed === '' ? null : Number(trimmed)
    if (total !== null && (!Number.isInteger(total) || total < 0)) {
      showToast('Quantity must be a whole number, or blank for unlimited.')
      return
    }
    setSavingQty(setCode)
    const supabase = createClient()
    const { error } = await supabase.rpc('set_vending_set_quantity', {
      p_set_code: setCode,
      p_total: total,
      p_reset_claimed: resetClaimed,
    })
    setSavingQty(null)
    if (error) { showToast('Failed to save quantity.'); return }
    showToast(
      total === null ? 'Set to unlimited.'
      : resetClaimed ? `Restocked to ${total}.`
      : `Limit set to ${total}.`
    )
    setQtyDrafts((d) => {
      const next = { ...d }
      delete next[setCode]
      return next
    })
    startTransition(() => router.refresh())
  }

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

                {/* ── Inventory ── */}
                {(() => {
                  const qDraft = qtyDrafts[s.set_code]
                  const qValue = qDraft ?? (s.totalQuantity == null ? '' : String(s.totalQuantity))
                  const qDirty = qDraft !== undefined &&
                    qDraft.trim() !== (s.totalQuantity == null ? '' : String(s.totalQuantity))
                  const left = s.totalQuantity == null ? null : Math.max(0, s.totalQuantity - s.claimedQuantity)
                  const out = left === 0
                  return (
                    <div className="rounded-xl border border-card-border bg-paper p-3 space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <label className="text-xs font-medium text-ink">Packs in the machine</label>
                        <span className={`font-mono text-[11px] ${out ? 'text-red-500' : 'text-muted'}`}>
                          {left === null
                            ? 'unlimited'
                            : `${left} of ${s.totalQuantity} left${out ? ' · sold out' : ''}`}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          value={qValue}
                          onChange={(e) => setQtyDrafts((d) => ({ ...d, [s.set_code]: e.target.value }))}
                          placeholder="Unlimited"
                          className="flex-1 bg-card border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-signal placeholder:text-muted"
                        />
                        <button
                          onClick={() => handleSaveQuantity(s.set_code, qValue, false)}
                          disabled={!qDirty || savingQty === s.set_code}
                          className="px-3 text-xs font-medium text-signal border border-signal/30 rounded-lg hover:bg-signal/10 transition-colors disabled:opacity-40"
                        >
                          {savingQty === s.set_code ? '…' : 'Save'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted leading-snug">
                          {s.claimedQuantity > 0
                            ? `${s.claimedQuantity} sold so far. Blank means unlimited.`
                            : 'Blank means unlimited.'}
                        </p>
                        {s.totalQuantity != null && s.claimedQuantity > 0 && (
                          <button
                            onClick={() => handleSaveQuantity(s.set_code, qValue, true)}
                            disabled={savingQty === s.set_code}
                            className="shrink-0 text-[11px] font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink transition-colors disabled:opacity-40"
                            title="Set the sold counter back to zero, refilling the machine"
                          >
                            Restock
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

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
