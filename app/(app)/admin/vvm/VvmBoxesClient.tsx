'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, money, num } from '../../vending/tokens'
import { useToast } from '@/components/ui/Toast'

/**
 * A row of vending_boxes (v62): a whole box of one set's packs, with its own
 * limited stock. An admin sets how many boxes there are (and restocks, which
 * also starts a new batch for the per-member limit), how often one turns up,
 * the price, the packs inside, the limit, and whether it's in the machine.
 */
export interface BoxRow {
  id: number
  set_code: string
  name: string
  description: string | null
  packs: number
  token_price: number
  total_quantity: number
  claimed_quantity: number
  per_user_limit: number | null
  appearance_rate: number
  is_active: boolean
  restocked_at: string
  /** A wrapper of the set, for the thumbnail. */
  image_url: string | null
}

const DESCRIPTION_MAX = 500

export default function VvmBoxesClient({ boxes }: { boxes: BoxRow[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const toast = useToast()
  if (boxes.length === 0) return null
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Booster Boxes</h2>
        <p className="text-xs text-muted leading-snug">
          A whole box of a set&apos;s packs, from its own stock (not the set&apos;s single packs). At each restock one
          turns up with the appearance rate&apos;s chance while any are left. Restock refills it and starts a new
          batch: everyone may buy their box again.
        </p>
      </div>
      <ul className="space-y-2">
        {boxes.map((b) => (
          <BoxCard key={b.id} box={b} onToast={(m) => toast.show(m)} onSaved={() => startTransition(() => router.refresh())} />
        ))}
      </ul>
    </div>
  )
}

function BoxCard({ box, onToast, onSaved }: { box: BoxRow; onToast: (m: string) => void; onSaved: () => void }) {
  const [active, setActive] = useState(box.is_active)
  const [total, setTotal] = useState(String(box.total_quantity))
  const [rate, setRate] = useState(box.appearance_rate)
  const [price, setPrice] = useState(fmt(box.token_price))
  const [packs, setPacks] = useState(String(box.packs))
  const [limit, setLimit] = useState(box.per_user_limit == null ? '' : String(box.per_user_limit))
  const [description, setDescription] = useState(box.description ?? '')
  const [saving, setSaving] = useState(false)

  const left = Math.max(0, box.total_quantity - box.claimed_quantity)
  const dirty = active !== box.is_active || total !== String(box.total_quantity) || rate !== box.appearance_rate ||
    Number(price) !== num(box.token_price) || packs !== String(box.packs) ||
    limit !== (box.per_user_limit == null ? '' : String(box.per_user_limit)) || description.trim() !== (box.description ?? '')

  function reset() {
    setActive(box.is_active); setTotal(String(box.total_quantity)); setRate(box.appearance_rate); setPrice(fmt(box.token_price))
    setPacks(String(box.packs)); setLimit(box.per_user_limit == null ? '' : String(box.per_user_limit)); setDescription(box.description ?? '')
  }

  async function save(restock: boolean) {
    const t = Number(total), p = Number(price), k = Number(packs), l = limit.trim() === '' ? null : Number(limit)
    if (!Number.isInteger(t) || t < 0) { onToast('Boxes in stock must be a whole number.'); return }
    if (!restock && t < box.claimed_quantity) { onToast(`${box.claimed_quantity} already sold: restock to go lower.`); return }
    if (!Number.isFinite(p) || p < 0) { onToast('Price must be 0 or more.'); return }
    if (!Number.isInteger(k) || k < 1) { onToast('A box needs at least one pack.'); return }
    if (l !== null && (!Number.isInteger(l) || l < 1)) { onToast('The limit must be 1 or more, or blank for none.'); return }
    setSaving(true)
    const { error } = await createClient().rpc('admin_update_box', {
      p_id: box.id, p_total: t, p_restock: restock, p_appearance_rate: rate, p_token_price: money(p),
      p_packs: k, p_limit: l, p_active: active, p_description: description,
    })
    setSaving(false)
    if (error) { onToast('Failed to save.'); return }
    onToast(restock ? `${box.name} restocked to ${t}.` : `${box.name} saved.`)
    onSaved()
  }

  return (
    <li className={`bg-card border border-card-border rounded-2xl p-4 space-y-3 ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        {box.image_url
          ? <img src={box.image_url} alt="" className="w-12 h-16 object-contain rounded bg-paper shrink-0" />
          : <div className="w-12 h-16 rounded bg-paper shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{box.name}</p>
          <p className="font-mono text-[11px] text-muted">{box.set_code} · {box.packs} packs · {fmt(num(box.token_price))} tokens</p>
        </div>
        <label className="shrink-0 flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-signal" />
          In the machine
        </label>
      </div>

      {/* ── Stock ── */}
      <div className="rounded-xl border border-card-border bg-paper p-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs font-medium text-ink">Boxes in stock</label>
          <span className={`font-mono text-[11px] ${left === 0 ? 'text-red-500' : 'text-muted'}`}>
            {left} of {box.total_quantity} left{left === 0 ? ' · sold out' : ''}
          </span>
        </div>
        <div className="flex gap-2">
          <input type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)}
            className="flex-1 bg-card border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-signal" />
          <button onClick={() => save(true)} disabled={saving}
            className="shrink-0 text-[11px] font-medium text-muted border border-card-border rounded-lg px-2.5 hover:text-ink transition-colors disabled:opacity-40"
            title="Set the sold count back to zero and start a new batch: everyone may buy their box again">
            Restock
          </button>
        </div>
        <p className="text-[11px] text-muted leading-snug">
          {box.claimed_quantity > 0 ? `${box.claimed_quantity} sold since the last restock.` : 'None sold since the last restock.'}
        </p>
      </div>

      {/* ── Rarity, price, contents, limit ── */}
      <div className="rounded-xl border border-card-border bg-paper p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium">Appearance rate <span className="text-muted font-normal">per restock</span></label>
          <span className="font-mono text-xs font-semibold">{rate}%</span>
        </div>
        <input type="range" min={0} max={100} step={1} value={rate} onChange={(e) => setRate(Number(e.target.value))}
          className="w-full accent-signal" aria-label="Appearance rate" />
        {[
          { label: 'Price', unit: 'tokens', value: price, set: setPrice, step: 1, placeholder: '' },
          { label: 'Packs in the box', unit: 'packs', value: packs, set: setPacks, step: 1, placeholder: '' },
          { label: 'Limit per member', unit: 'per batch', value: limit, set: setLimit, step: 1, placeholder: 'None' },
        ].map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium">{f.label}</label>
            <span className="flex items-center gap-1.5">
              <input type="number" min={0} step={f.step} value={f.value} placeholder={f.placeholder} onChange={(e) => f.set(e.target.value)}
                className="w-20 bg-card border border-card-border rounded-lg px-2 py-1 text-sm text-right font-mono outline-none focus:border-signal placeholder:text-muted" />
              <span className="text-xs text-muted w-16">{f.unit}</span>
            </span>
          </div>
        ))}
      </div>

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={DESCRIPTION_MAX}
        placeholder="What a shopper sees when they tap the box…"
        className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal resize-none placeholder:text-muted" />

      {dirty && (
        <div className="flex justify-end gap-1.5">
          <button onClick={reset}
            className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink transition-colors">
            Cancel
          </button>
          <button onClick={() => save(false)} disabled={saving}
            className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1 hover:bg-signal/10 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </li>
  )
}
