'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { createClient } from '@/lib/supabase/client'
import { compareCardNumbers, rarityName } from '@/lib/vending/games'
import { fmt, num } from './tokens'
import type { CollectionCard } from './CollectionPanel'

/**
 * The LCS: a local card shop that buys your unwanted cards for a little token
 * each (v98: lcs_offer, lcs_sell). What it pays is the database's, card by
 * card: the rarity's price times the card's condition (holo, secret and
 * parallel rares on condition, bulk at a flat rate).
 *
 * You pick how many of each card to sell; the shop takes the copies worth
 * least first, so the best one stays in your binder. Only raw cards in hand
 * are offered: not graded, at the cleaners, listed or on your showcase.
 */

type Row = {
  card: CollectionCard
  /** Copies the shop will buy, worth least first. */
  sellable: { id: number; value: number }[]
}

const BULK = new Set(['C', 'U'])

export default function LcsSheet({ open, onClose, cards, setNames }: {
  open: boolean
  onClose: () => void
  /** This game's cards (the Pokémon or One Piece shelf you're on). */
  cards: CollectionCard[]
  setNames: Record<string, string>
}) {
  const router = useRouter()
  const [offer, setOffer] = useState<{ values: Map<number, number>; carry: number } | null>(null)
  const [pick, setPick] = useState<Record<number, number>>({})
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ sold: number; paid: number; carry: number } | null>(null)

  useEffect(() => {
    if (!open) return
    let gone = false
    setOffer(null); setPick({}); setConfirming(false); setError(null); setDone(null)
    createClient().rpc('lcs_offer').then(({ data, error: e }) => {
      if (gone) return
      if (e) { setError("The shop couldn't price your cards. Try again in a moment."); return }
      const o = data as { carry: unknown; cards: { id: number; value: unknown }[] } | null
      setOffer({ values: new Map((o?.cards ?? []).map((c) => [c.id, num(c.value)])), carry: num(o?.carry) })
    })
    return () => { gone = true }
  }, [open])

  const rows: Row[] = useMemo(() => {
    if (!offer) return []
    return cards
      .map((card) => ({
        card,
        sellable: card.copies
          .filter((c) => offer.values.has(c.id))
          .map((c) => ({ id: c.id, value: offer.values.get(c.id)!, wear: c.corners + c.edges + c.surface + c.border_wear }))
          .sort((a, b) => a.value - b.value || a.wear - b.wear)
          .map(({ id, value }) => ({ id, value })),
      }))
      .filter((r) => r.sellable.length > 0)
      .sort((a, b) => a.card.set_code.localeCompare(b.card.set_code) || compareCardNumbers(a.card.number, b.card.number))
  }, [cards, offer])

  const chosen = rows.flatMap((r) => r.sellable.slice(0, pick[r.card.card_id] ?? 0))
  const count = chosen.length
  const value = chosen.reduce((s, c) => s + c.value, 0)
  const carry = offer?.carry ?? 0
  const payout = Math.floor((value + carry) * 100 + 1e-6) / 100

  const set = (id: number, n: number) => setPick((p) => ({ ...p, [id]: n }))
  // Extras: everything but one copy of each card (graded or listed copies count as the one you keep).
  const pickExtras = () => setPick(Object.fromEntries(rows.map((r) => [r.card.card_id, Math.min(r.sellable.length, r.card.copies.length - 1)])))
  const pickBulk = () => setPick(Object.fromEntries(rows.map((r) => [r.card.card_id, BULK.has(r.card.rarity) ? r.sellable.length : 0])))

  async function sell() {
    if (!count || busy) return
    setBusy(true); setError(null)
    const { data, error: e } = await createClient().rpc('lcs_sell', { p_ids: chosen.map((c) => c.id) })
    setBusy(false)
    const r = (data as { ok: boolean; reason: string; sold: number; paid: unknown; carry: unknown }[] | null)?.[0]
    if (e || !r) { setError('The sale didn\'t go through. Nothing was sold.'); return }
    if (!r.ok) {
      setConfirming(false)
      setError(r.reason === 'not_sellable'
        ? 'Some of those cards can\'t be sold any more (sent off, listed or put on show). Nothing was sold: pick again.'
        : r.reason === 'too_many' ? 'That\'s more than 1,000 cards: sell them in a few goes.' : 'Nothing was sold.')
      return
    }
    setDone({ sold: r.sold, paid: num(r.paid), carry: num(r.carry) })
    router.refresh()
  }

  let lastSet = ''
  return (
    <Sheet open={open} onClose={() => { if (!busy) onClose() }} title="Local Card Shop" wide
      footer={done ? (
        <button onClick={onClose} className="w-full rounded-xl bg-ink text-white text-sm font-semibold py-2.5">Done</button>
      ) : confirming ? (
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} disabled={busy}
            className="flex-1 rounded-xl border border-card-border text-sm font-medium py-2.5 text-muted hover:text-ink disabled:opacity-40">Back</button>
          <button onClick={sell} disabled={busy}
            className="flex-1 rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 disabled:opacity-40">
            {busy ? 'Selling…' : `Sell for ${fmt(payout)} tk`}
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} disabled={!count}
          className="w-full rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 disabled:opacity-40">
          {count ? `Sell ${count} card${count === 1 ? '' : 's'} · ${fmt(payout)} tk` : 'Pick cards to sell'}
        </button>
      )}>
      {done ? (
        <div className="text-center space-y-2 py-6">
          <p className="text-3xl">🤝</p>
          <p className="font-display font-semibold">Sold {done.sold} card{done.sold === 1 ? '' : 's'} for {fmt(done.paid)} tokens</p>
          <p className="text-xs text-muted">
            The shop thanks you for your business.
            {done.carry > 0 && <> {done.carry.toFixed(4).replace(/0+$/, '')} of a token is saved toward your next sale.</>}
          </p>
        </div>
      ) : confirming ? (
        <div className="space-y-2 py-2 text-sm">
          <p>Sell <b>{count}</b> card{count === 1 ? '' : 's'} to the shop for <b>{fmt(payout)} tokens</b>?</p>
          <p className="text-muted text-xs">They leave your collection for good. The shop doesn&apos;t sell them back.</p>
          {value + carry - payout > 0.00001 && (
            <p className="text-muted text-xs">The last {(value + carry - payout).toFixed(4).replace(/0+$/, '')} of a token waits for your next sale.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted leading-relaxed">
            The shop buys your unwanted cards for a little token each. Holo, secret and parallel rares fetch more the better
            their condition; bulk goes at a flat rate. It takes the copies worth least first, so your best one stays.
            Graded cards, cards away at the cleaners, Market listings and showcase cards aren&apos;t offered.
          </p>
          {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>}
          {!offer ? (
            !error && <p className="text-sm text-muted py-6 text-center">The shop is pricing your cards…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Nothing here the shop can buy right now.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={pickExtras} className="text-xs font-medium rounded-lg border border-card-border px-3 py-1.5 hover:text-ink text-muted">Extras (keep 1 of each)</button>
                <button onClick={pickBulk} className="text-xs font-medium rounded-lg border border-card-border px-3 py-1.5 hover:text-ink text-muted">All commons &amp; uncommons</button>
                <button onClick={() => setPick({})} className="text-xs font-medium rounded-lg border border-card-border px-3 py-1.5 hover:text-ink text-muted">Clear</button>
              </div>
              <ul className="space-y-1">
                {rows.map((r) => {
                  const n = pick[r.card.card_id] ?? 0
                  const worth = r.sellable.slice(0, n).reduce((s, c) => s + c.value, 0)
                  const each = r.sellable[0].value === r.sellable[r.sellable.length - 1].value
                    ? fmtSmall(r.sellable[0].value) : `${fmtSmall(r.sellable[0].value)}–${fmtSmall(r.sellable[r.sellable.length - 1].value)}`
                  const head = r.card.set_code !== lastSet ? (lastSet = r.card.set_code, setNames[r.card.set_code] ?? r.card.set_code) : null
                  return (
                    <li key={r.card.card_id}>
                      {head && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted pt-2 pb-1">{head}</p>}
                      <div className={`flex items-center gap-2 rounded-xl border p-1.5 ${n ? 'border-signal/50 bg-signal/5' : 'border-card-border bg-card'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.card.image_url} alt="" loading="lazy" className="w-9 aspect-[245/342] rounded object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.card.name}</p>
                          <p className="text-[11px] text-muted truncate">
                            #{r.card.number} · {rarityName(r.card.rarity, r.card.set_code)} · {each} tk each · {r.card.copies.length} owned
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => set(r.card.card_id, Math.max(0, n - 1))} disabled={!n} aria-label={`One fewer ${r.card.name}`}
                            className="w-8 h-8 rounded-lg border border-card-border text-lg leading-none disabled:opacity-30">−</button>
                          <span className="w-12 text-center font-mono text-xs">
                            {n}/{r.sellable.length}
                            {n > 0 && <span className="block text-[10px] text-muted">{fmtSmall(worth)}</span>}
                          </span>
                          <button onClick={() => set(r.card.card_id, Math.min(r.sellable.length, n + 1))} disabled={n >= r.sellable.length} aria-label={`One more ${r.card.name}`}
                            className="w-8 h-8 rounded-lg border border-card-border text-lg leading-none disabled:opacity-30">+</button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {carry > 0 && <p className="text-[11px] text-muted">Plus {carry.toFixed(4).replace(/0+$/, '')} of a token saved from your last sale.</p>}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** A card's price: to the cent when it's at least one, otherwise to the tenth of a cent ("0.0075"). */
function fmtSmall(v: number): string {
  return v >= 0.1 ? v.toFixed(2) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
