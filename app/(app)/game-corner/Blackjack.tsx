'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money } from '../vending/tokens'
import { refusal, type BjHand, type BjSeat, type BjTable, type CornerState } from './state'
import { canDouble, canSplit, cardName, handTotal, isRed, RANKS, rankOf, revealAt, SUITS, suitOf, totalLabel } from './blackjack'

const WORDS = {
  seat_taken: 'Someone is sitting there.',
  not_seated: 'Take a seat first.',
  bets_closed: 'Too late: the cards are out.',
  not_enough_tokens: 'Not enough tokens for that.',
}
const SIZES = { sm: { w: 24, h: 34, f: 10, step: 12 }, md: { w: 40, h: 57, f: 13, step: 24 }, lg: { w: 52, h: 74, f: 16, step: 30 } } as const
type Size = keyof typeof SIZES
/** How far each seat sits down the felt's curve, left to right. */
const ARC = [0, 12, 18, 12, 0]
const CHIPS = [0.1, 0.25, 0.5, 1, 2, 5]

/** One playing card, or its back (-1). Each slides in as it's dealt, and the dealer's face-down card as it turns. */
function Card({ c, size }: { c: number; size: Size }) {
  const { w, h, f } = SIZES[size]
  const style = { width: w, height: h, animation: 'bj-in .28s ease-out' }
  if (c < 0) {
    return (
      <div role="img" aria-label="face-down card" className="rounded-[5px] border-2 border-white bg-red-700 shadow-sm"
        style={{ ...style, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.2) 0 3px, transparent 3px 7px)' }} />
    )
  }
  const rank = RANKS[rankOf(c)], suit = SUITS[suitOf(c)]
  return (
    <div role="img" aria-label={cardName(c)} className="relative rounded-[5px] bg-white border border-zinc-300 shadow-sm select-none"
      style={{ ...style, color: isRed(c) ? '#dc2626' : '#18181b' }}>
      <span className="absolute left-[3px] top-[2px] font-bold leading-[0.95] text-center"
        style={{ fontSize: size === 'sm' && rank === '10' ? f - 1.5 : f, letterSpacing: rank === '10' ? '-0.08em' : undefined, marginLeft: size === 'sm' && rank === '10' ? -1.5 : 0 }}>
        {rank}{size !== 'sm' && <><br />{suit}</>}
      </span>
      {size === 'sm' ? (
        <span className="absolute right-[2px] bottom-[1px] leading-none" style={{ fontSize: f }}>{suit}</span>
      ) : (
        <span className="absolute inset-0 grid place-items-center leading-none pt-2" style={{ fontSize: f * 1.6 }}>{suit}</span>
      )}
    </div>
  )
}

/** A hand's cards, overlapping; the overlap tightens so a long hand still fits in `max` pixels. */
function Fan({ cards, size, max }: { cards: number[]; size: Size; max?: number }) {
  const { w, h, step: full } = SIZES[size]
  const n = cards.length
  const step = n > 1 && max ? Math.min(full, (max - w) / (n - 1)) : full
  return (
    <div className="relative shrink-0" style={{ width: n ? w + step * (n - 1) : w, height: h }}>
      {cards.map((c, i) => (
        <div key={`${i}:${c}`} className="absolute top-0" style={{ left: i * step }}><Card c={c} size={size} /></div>
      ))}
    </div>
  )
}

/** How a paid hand came out, short. */
function outcome(h: BjHand): { text: string; good: boolean } {
  const p = h.payout ?? 0
  if (h.result === 'blackjack') return { text: `Blackjack! +${fmt(money(p - h.bet))}`, good: true }
  if (h.result === 'win') return { text: `+${fmt(money(p - h.bet))}`, good: true }
  if (h.result === 'push') return { text: 'Push', good: false }
  return { text: h.status === 'bust' ? 'Bust' : 'Lost', good: false }
}

/** A seat round the felt: its hands (small), its bet, and who's sitting there, or a place to sit. */
function Spot({ seat, t, settled, offset, canSit, moving, sitting, onSit }: {
  seat: BjSeat; t: BjTable; settled: boolean; offset: number; canSit: boolean; moving: boolean; sitting: boolean; onSit: () => void
}) {
  const turn = t.phase === 'playing' && t.turn?.seat === seat.seat
  const name = seat.mine ? 'You' : seat.player ?? seat.hands[0]?.player ?? null
  const staked = money(seat.hands.reduce((a, h) => a + h.bet, 0))
  return (
    <div className={`flex flex-col items-center justify-end gap-1 rounded-xl px-0.5 py-1 min-w-0 ${turn ? 'bg-white/15 ring-2 ring-amber-300' : ''}`}
      style={{ marginTop: offset }}>
      {seat.hands.map((h) => (
        <div key={h.hand} className={`flex flex-col items-center gap-0.5 ${turn && t.turn?.hand !== h.hand ? 'opacity-60' : ''}`}>
          {h.cards.length > 0 && <Fan cards={h.cards} size="sm" max={58} />}
          {h.cards.length > 0 && (
            <span className={`rounded px-1 text-[10px] leading-4 font-semibold ${settled && h.result ? (outcome(h).good ? 'bg-amber-300 text-ink' : 'bg-black/30 text-white/80') : 'bg-black/30'}`}>
              {settled && h.result ? outcome(h).text.replace('Blackjack! ', 'BJ ') : totalLabel(h)}
            </span>
          )}
        </div>
      ))}
      {staked > 0 && (
        <span className="grid place-items-center min-w-8 h-5 px-1 rounded-full border-2 border-dashed border-ink/60 bg-amber-300 text-ink text-[10px] font-mono font-bold">{fmt(staked)}</span>
      )}
      {name ? (
        <span className={`max-w-full truncate text-[11px] ${seat.mine ? 'font-bold text-amber-200' : 'text-white/90'}`}>{name}</span>
      ) : canSit ? (
        <button type="button" onClick={onSit} disabled={sitting} aria-label={`Sit in seat ${seat.seat}`}
          className="grid place-items-center w-11 h-11 rounded-full border-2 border-dashed border-white/60 text-[11px] font-semibold hover:bg-white/15 disabled:opacity-50">
          {sitting ? '…' : moving ? 'Move' : 'Sit'}
        </button>
      ) : (
        <span className="grid place-items-center w-11 h-11 rounded-full border-2 border-dashed border-white/25 text-[10px] text-white/40" aria-label={`Seat ${seat.seat}, empty`}>{seat.seat}</span>
      )}
    </div>
  )
}

/**
 * The blackjack tables: three of them, five seats each, shared. Sit at a free seat and you're dealt in from the
 * next hand; everyone sees every seat's cards and the dealer's. Bets open until 15 s after the first (or until
 * everyone sitting there has bet), then turns seat by seat, 20 s each, then the dealer, then the results.
 */
export default function Blackjack({ state, skew, onPlayed }: { state: CornerState; skew: number; onPlayed: () => void }) {
  const bj = state.blackjack
  const mine = bj.mine
  const [view, setView] = useState<number | null>(null)
  const [stake, setStake] = useState(0)
  const [lastBet, setLastBet] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lock, setLock] = useState<{ sig: string; at: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(id) }, [])

  // The table in view: the one picked, else your own, else the liveliest one with a free seat.
  const busiest = [...bj.tables].sort((a, b) => b.seats.filter((s) => s.player).length - a.seats.filter((s) => s.player).length)
    .find((t) => t.seats.some((s) => !s.player)) ?? bj.tables[0]
  const t = bj.tables.find((x) => x.table === (view ?? mine?.table ?? busiest?.table)) ?? bj.tables[0]
  if (!t) return null

  const now = Date.now() + skew
  const secs = (iso: string | null) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : 0)
  const atThis = mine?.table === t.table
  const mySeat = atThis && mine ? t.seats.find((s) => s.seat === mine.seat) : undefined
  const myHands = mySeat?.hands.filter((h) => h.mine) ?? []
  const inHand = bj.tables.some((x) => x.seats.some((s) => s.hands.some((h) => h.mine && h.result == null)))
  const chips = CHIPS.filter((c) => c >= state.caps.min && c <= state.caps.blackjack)

  // Once the hand is done the dealer's cards turn over one by one, and the results show after the last.
  const doneAt = t.done_at ? Date.parse(t.done_at) : 0
  const dealer = t.phase === 'done'
    ? t.dealer.flatMap((c, i) => (now >= doneAt + revealAt(i) ? [c] : i === 1 ? [-1] : []))
    : t.dealer
  const settled = t.phase === 'done' && now >= doneAt + revealAt(t.dealer.length - 1) + 300
  const dealerTotal = handTotal(dealer)
  const dealerLabel = dealer.length === 0 ? '' : t.phase === 'playing' ? totalLabel({ cards: dealer, status: 'playing' })
    : dealer.length === 2 && dealerTotal.total === 21 && !dealer.includes(-1) ? 'Blackjack' : dealerTotal.total > 21 ? `Bust, ${dealerTotal.total}` : String(dealerTotal.total)

  const turnHand = t.phase === 'playing' && t.turn ? t.seats.find((s) => s.seat === t.turn!.seat)?.hands.find((h) => h.hand === t.turn!.hand) : undefined
  const myTurn = !!turnHand?.mine && atThis
  const turnLeft = t.turn ? Math.max(0, Date.parse(t.turn.ends_at) - now) : 0

  // A move is locked from the moment it's sent until the table reads back different (or 3 s pass), so a quick
  // second tap can't hit twice.
  const sig = JSON.stringify([t.phase, t.round, t.turn?.seat, t.turn?.hand, myHands.map((h) => [h.cards.length, h.status, h.bet])])
  const locked = !!busy || (lock?.sig === sig && Date.now() - lock.at < 3000)

  async function call(what: string, fn: string, args?: Record<string, unknown>) {
    if (busy) return false
    const before = sig
    setBusy(what); setNote(null)
    const { error } = await createClient().rpc(fn, args)
    setBusy(null)
    if (error) { setNote(refusal(error, WORDS)); return false }
    setLock({ sig: before, at: Date.now() })
    onPlayed()
    return true
  }
  const sit = async (table: number, seat: number) => { if (await call(`sit:${table}:${seat}`, 'game_corner_bj_sit', { p_table: table, p_seat: seat })) setView(null) }
  const bet = async (amount: number) => { if (await call('bet', 'game_corner_bj_bet', { p_amount: amount })) { setLastBet(amount); setStake(0) } }
  const act = (move: 'hit' | 'stand' | 'double' | 'split') => call(move, 'game_corner_bj_act', { p_action: move })

  // What's happening, in a line under the felt.
  let line: string
  if (t.phase === 'betting') {
    line = t.bets_close_at ? `Bets close in ${secs(t.bets_close_at)}s`
      : !t.seats.some((s) => s.player) ? 'Nobody’s here yet. Take a seat.'
      : atThis ? 'Place a bet to start the next hand.' : 'Waiting for someone to bet.'
  } else if (t.phase === 'playing') {
    line = myTurn ? `Your turn · ${secs(t.turn?.ends_at ?? null)}s` : `${turnHand?.player ?? 'Someone'}’s turn · ${secs(t.turn?.ends_at ?? null)}s`
  } else {
    line = !settled ? 'The dealer plays…'
      : `${dealerLabel === 'Blackjack' ? 'Dealer has blackjack.' : dealerTotal.total > 21 ? `Dealer busts with ${dealerTotal.total}.` : `Dealer has ${dealerTotal.total}.`} Next hand in ${secs(t.next_at)}s`
  }

  const mineDealt = myHands.length > 0 && myHands[0].status !== 'betting'
  const myStake = money(myHands.reduce((a, h) => a + h.bet, 0))
  const myBack = money(myHands.reduce((a, h) => a + (h.payout ?? 0), 0))

  return (
    <div className="space-y-4">
      <style>{'@keyframes bj-in{from{transform:translateY(-10px) scale(.92);opacity:0}to{transform:none;opacity:1}}'}</style>

      <nav aria-label="Tables" className="grid grid-cols-3 gap-1.5">
        {bj.tables.map((x) => {
          const n = x.seats.filter((s) => s.player).length
          return (
            <button key={x.table} type="button" onClick={() => setView(x.table)} aria-pressed={x.table === t.table}
              className={`rounded-xl border px-2 py-1.5 text-left ${x.table === t.table ? 'border-ink bg-ink text-white' : 'border-card-border bg-card'}`}>
              <span className="block text-sm font-semibold">Table {x.table}{mine?.table === x.table && <span className="ml-1 text-signal" aria-label="(yours)">●</span>}</span>
              <span className={`block text-[11px] ${x.table === t.table ? 'text-white/70' : 'text-muted'}`}>{n}/5 · {n === 0 ? 'empty' : x.phase === 'betting' ? 'betting' : 'playing'}</span>
            </button>
          )
        })}
      </nav>

      <section aria-label={`Table ${t.table}`} className="rounded-[2rem] p-3 pb-4 text-white shadow-inner bg-[radial-gradient(ellipse_at_top,#047857,#064e3b_70%)] border-4 border-amber-900/80">
        <div className="flex flex-col items-center gap-1 min-h-[92px]">
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">Dealer</span>
          {dealer.length > 0 ? <Fan cards={dealer} size="md" /> : <div className="h-[57px] w-10 rounded-[5px] border border-dashed border-white/20" aria-hidden />}
          {dealerLabel && <span className="rounded bg-black/30 px-1.5 text-xs leading-5 font-semibold">{dealerLabel}</span>}
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">Blackjack pays 3 to 2</p>
        <p className="text-center text-[10px] text-white/55">Dealer stands on all 17s</p>
        <div className="mt-2 grid grid-cols-5 gap-1 items-start">
          {t.seats.map((s, i) => (
            <Spot key={s.seat} seat={s} t={t} settled={settled} offset={ARC[i] ?? 0}
              canSit={state.open && !inHand} moving={!!mine} sitting={busy === `sit:${t.table}:${s.seat}`} onSit={() => sit(t.table, s.seat)} />
          ))}
        </div>
      </section>

      <p aria-live="polite" className={`text-center font-display font-semibold ${myTurn ? 'text-signal text-lg' : ''}`}>{line}</p>

      {atThis && mySeat ? (
        <section className="rounded-2xl border border-card-border bg-card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-semibold">Table {t.table} · seat {mySeat.seat}</h2>
            <button type="button" onClick={() => call('leave', 'game_corner_bj_leave')} disabled={!!busy} className="text-xs text-muted hover:text-ink underline">Leave table</button>
          </div>

          {mineDealt && (
            <div className="flex flex-wrap justify-center gap-3">
              {myHands.map((h) => {
                const active = myTurn && t.turn?.hand === h.hand
                return (
                  <div key={h.hand} className={`flex flex-col items-center gap-1 rounded-xl p-2 ${active ? 'ring-2 ring-signal' : ''}`}>
                    <Fan cards={h.cards} size="lg" max={myHands.length > 1 ? 130 : 220} />
                    <span className="text-sm font-semibold">{totalLabel(h)}</span>
                    <span className="text-xs text-muted">Bet <span className="font-mono">{fmt(h.bet)}</span>{h.doubled ? ' · doubled' : ''}</span>
                    {settled && h.result && <span className={`text-sm ${outcome(h).good ? 'text-signal font-semibold' : 'text-muted'}`}>{outcome(h).text}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {t.phase === 'betting' && myHands.length === 0 && (
            <div className="space-y-2">
              <p className="text-center text-sm">{stake > 0 ? <>Your bet <b className="font-mono">{fmt(stake)}</b></> : 'Tap chips to make your bet.'}</p>
              <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Chips">
                {chips.map((c) => (
                  <button key={c} type="button" onClick={() => setStake((s) => Math.min(state.caps.blackjack, money(s + c)))} disabled={money(stake + c) > state.caps.blackjack}
                    className="w-11 h-11 rounded-full border-2 border-dashed border-card-border text-xs font-mono font-bold hover:bg-signal hover:border-ink hover:text-ink disabled:opacity-40">{fmt(c)}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStake(0)} disabled={stake === 0} className="h-12 px-4 rounded-xl border border-card-border text-sm disabled:opacity-40">Clear</button>
                {stake === 0 && lastBet ? (
                  <button type="button" onClick={() => bet(lastBet)} disabled={locked || !state.open || state.balance < lastBet}
                    className="flex-1 h-12 rounded-xl bg-signal text-ink font-display font-bold disabled:opacity-50">Bet {fmt(lastBet)} again</button>
                ) : (
                  <button type="button" onClick={() => bet(stake)} disabled={locked || !state.open || stake === 0 || state.balance < stake}
                    className="flex-1 h-12 rounded-xl bg-signal text-ink font-display font-bold disabled:opacity-50">
                    {state.balance < stake ? 'Not enough tokens' : stake ? `Bet ${fmt(stake)}` : 'Bet'}
                  </button>
                )}
              </div>
              <p className="text-center text-[11px] text-muted">{fmt(state.caps.min)} to {fmt(state.caps.blackjack)} a hand.</p>
            </div>
          )}

          {t.phase === 'betting' && myHands.length > 0 && (
            <div className="text-center space-y-1">
              <p className="text-sm">Your bet <b className="font-mono">{fmt(myStake)}</b>. {t.bets_close_at ? 'Dealing when the others have bet, or the time’s up.' : ''}</p>
              <button type="button" onClick={() => call('unbet', 'game_corner_bj_unbet')} disabled={locked} className="text-xs text-muted hover:text-ink underline">Take it back</button>
            </div>
          )}

          {myTurn && turnHand && (
            <div className="space-y-2">
              <div className="h-1.5 rounded-full bg-card-border overflow-hidden" aria-hidden>
                <div className="h-full bg-signal transition-[width] duration-300 ease-linear" style={{ width: `${Math.min(100, turnLeft / 200)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => act('hit')} disabled={locked} className="h-12 rounded-xl bg-ink text-white font-display font-bold text-lg disabled:opacity-50">Hit</button>
                <button type="button" onClick={() => act('stand')} disabled={locked} className="h-12 rounded-xl bg-signal text-ink font-display font-bold text-lg disabled:opacity-50">Stand</button>
                {canDouble(turnHand) && (
                  <button type="button" onClick={() => act('double')} disabled={locked || state.balance < turnHand.bet}
                    className="h-11 rounded-xl border border-card-border text-sm font-medium disabled:opacity-50">
                    Double down <span className="text-muted font-mono">+{fmt(turnHand.bet)}</span>
                  </button>
                )}
                {canSplit(myHands, turnHand) && (
                  <button type="button" onClick={() => act('split')} disabled={locked || state.balance < turnHand.bet}
                    className="h-11 rounded-xl border border-card-border text-sm font-medium disabled:opacity-50">
                    Split <span className="text-muted font-mono">+{fmt(turnHand.bet)}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {t.phase === 'playing' && mineDealt && !myTurn && myHands.some((h) => h.status === 'playing') && (
            <p className="text-center text-sm text-muted">Your turn is coming.</p>
          )}
          {settled && mineDealt && (
            <p className={`text-center font-display font-semibold ${myBack > myStake ? 'text-signal' : ''}`}>
              {myBack > myStake ? `You win ${fmt(money(myBack - myStake))}!` : myBack === myStake ? `Push: your ${fmt(myStake)} back.` : 'The dealer wins this one.'}
            </p>
          )}
          {t.phase !== 'betting' && !mineDealt && <p className="text-center text-sm text-muted">You’re in from the next hand.</p>}
          {note && <p className="text-sm text-center text-muted">{note}</p>}
        </section>
      ) : (
        <section className="rounded-2xl border border-card-border bg-card p-3 text-sm space-y-2">
          {mine ? (
            <div className="flex items-center justify-between gap-2">
              <span>You’re sitting at Table {mine.table}.</span>
              <button type="button" onClick={() => setView(null)} className="h-9 px-3 rounded-lg bg-ink text-white text-sm font-medium">Back to your seat</button>
            </div>
          ) : (
            <p className="text-muted">{state.open ? 'Pick an empty seat to join. You’re dealt in from the next hand.' : 'The tables are closed for now.'}</p>
          )}
          {note && <p className="text-muted">{note}</p>}
        </section>
      )}

      <section className="rounded-2xl border border-card-border bg-card p-3">
        <button type="button" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules} className="w-full text-left text-sm font-semibold flex justify-between">
          House rules <span className="text-muted font-normal">{showRules ? 'Hide' : 'Show'}</span>
        </button>
        {showRules && (
          <ul className="mt-2 space-y-1 text-xs text-muted list-disc pl-4">
            <li>Six decks, shuffled again once about three-quarters have been dealt.</li>
            <li>Blackjack (an ace and a ten-card as your first two) pays 3 to 2. Other wins pay even money; a tie is a push and you get your bet back.</li>
            <li>With an ace or a ten showing, the dealer checks for blackjack before anyone plays. The dealer draws to 17 and stands on every 17, soft ones too.</li>
            <li>Double down on any first two cards: your bet doubles and you get one more card. Split a pair once; split aces get one card each. You can double after splitting.</li>
            <li>20 seconds a decision, then you stand. Leave the page on your turn and you stand too.</li>
            <li>No insurance, no surrender. With perfect play the house keeps about half a percent: the best odds in the Game Corner.</li>
          </ul>
        )}
      </section>
    </div>
  )
}
