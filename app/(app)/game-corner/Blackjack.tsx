'use client'

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money } from '../vending/tokens'
import { capsFor, refusal, type BjHand, type BjSeat, type BjTable, type CornerState } from './state'
import { canDouble, canSplit, cardName, handTotal, isRed, RANKS, rankOf, revealAt, SUITS, suitOf, totalLabel } from './blackjack'
import { centerOf, Chip, ChipStack, chipsFor, GOLD_TEXT, NOISE, RAIL_LUXE, RAIL_WORN, SCUFFS, VELVET, VELVET_RED, useCelebration } from './fx'
import { sfx } from './sfx'

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
/** The table's outline: square at the dealer's side, rounding away under the players. */
const TABLE_SHAPE = '22px 22px 50% 50% / 22px 22px 30% 30%'
const BACK: CSSProperties = {
  backgroundColor: '#b91c1c',
  backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.35) 0 18%, transparent 19%), repeating-linear-gradient(45deg, rgba(255,255,255,.2) 0 3px, transparent 3px 7px)',
}
/** The high-limit table's deck: black backs, a gold lattice. */
const BACK_LUXE: CSSProperties = {
  backgroundColor: '#0c0a09',
  backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(243,210,122,.75) 0 12%, transparent 13%), repeating-linear-gradient(45deg, rgba(243,210,122,.4) 0 1px, transparent 1px 5px), repeating-linear-gradient(-45deg, rgba(243,210,122,.4) 0 1px, transparent 1px 5px)',
  borderColor: '#e5c158',
}
/** Whether the cards on show are the high-limit table's deck. */
const LuxeDeck = createContext(false)

/**
 * One playing card, or its back (-1). It flies in from the shoe (`from`: where the shoe is, from where the card
 * lands) as it's dealt, or turns over (`turn`) when it's the dealer's face-down card coming up.
 */
function Card({ c, size, from, turn }: { c: number; size: Size; from: [number, number]; turn?: boolean }) {
  const luxe = useContext(LuxeDeck)
  const { w, h, f } = SIZES[size]
  const style = {
    width: w, height: h, ['--fx' as string]: `${from[0]}px`, ['--fy' as string]: `${from[1]}px`,
    animation: turn ? 'gc-turn .32s ease-out both' : 'gc-deal .4s cubic-bezier(.2,.8,.3,1) both',
  }
  if (c < 0) {
    return <div role="img" aria-label="face-down card" className="rounded-[5px] border-2 border-white shadow-md gc-motion" style={{ ...style, ...(luxe ? BACK_LUXE : BACK) }} />
  }
  const rank = RANKS[rankOf(c)], suit = SUITS[suitOf(c)], color = isRed(c) ? '#dc2626' : '#18181b'
  const face = rankOf(c) >= 10
  return (
    <div role="img" aria-label={cardName(c)} className="relative rounded-[5px] border shadow-md select-none gc-motion"
      style={{ ...style, color, background: luxe ? 'linear-gradient(160deg,#fffefa,#f6f1e4)' : 'linear-gradient(160deg,#ffffff,#f5f5f4)', borderColor: luxe ? '#d9bd6a' : '#d4d4d8' }}>
      <span className="absolute left-[3px] top-[2px] font-bold leading-[0.95] text-center"
        style={{ fontSize: size === 'sm' && rank === '10' ? f - 1.5 : f, letterSpacing: rank === '10' ? '-0.08em' : undefined, marginLeft: size === 'sm' && rank === '10' ? -1.5 : 0 }}>
        {rank}{size !== 'sm' && <><br />{suit}</>}
      </span>
      {size === 'sm' ? (
        <span className="absolute right-[2px] bottom-[1px] leading-none" style={{ fontSize: f }}>{suit}</span>
      ) : face ? (
        // A picture card: framed, its letter and suit large.
        <span className="absolute grid place-items-center rounded-[3px] font-black leading-none" style={{
          inset: '24% 14% 10% 26%', fontSize: f * 1.25, border: `1px solid ${color}`,
          background: isRed(c) ? 'linear-gradient(160deg,#fee2e2,#fecaca)' : 'linear-gradient(160deg,#e4e4e7,#d4d4d8)',
        }}>{rank}<span style={{ fontSize: f * 0.9 }}>{suit}</span></span>
      ) : (
        <span className="absolute inset-0 grid place-items-center leading-none pt-2" style={{ fontSize: f * (rank === 'A' ? 2 : 1.6) }}>{suit}</span>
      )}
    </div>
  )
}

/** A hand's cards, overlapping; the overlap tightens so a long hand still fits in `max` pixels. */
function Fan({ cards, size, max, from, turnAt }: { cards: number[]; size: Size; max?: number; from: [number, number]; turnAt?: number }) {
  const { w, h, step: full } = SIZES[size]
  const n = cards.length
  const step = n > 1 && max ? Math.min(full, (max - w) / (n - 1)) : full
  return (
    <div className="relative shrink-0" style={{ width: n ? w + step * (n - 1) : w, height: h }}>
      {cards.map((c, i) => (
        <div key={`${i}:${c}`} className="absolute top-0" style={{ left: i * step }}>
          <Card c={c} size={size} from={[from[0] - i * step, from[1]]} turn={i === turnAt && c >= 0} />
        </div>
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

/** A seat round the felt: its hands (small), its betting circle with the chips in it, and who's sitting there. */
function Spot({ seat, index, t, settled, canSit, moving, sitting, onSit }: {
  seat: BjSeat; index: number; t: BjTable; settled: boolean; canSit: boolean; moving: boolean; sitting: boolean; onSit: () => void
}) {
  const turn = t.phase === 'playing' && t.turn?.seat === seat.seat
  const name = seat.mine ? 'You' : seat.player ?? seat.hands[0]?.player ?? null
  const staked = money(seat.hands.reduce((a, h) => a + h.bet, 0))
  const won = settled && seat.hands.some((h) => h.result && outcome(h).good)
  // The shoe is at the felt's top right: cards fly further to the seats on the left.
  const from: [number, number] = [(4 - index) * 62 + 40, -150 - ARC[index]]
  return (
    <div className={`flex flex-col items-center justify-end gap-1 rounded-xl px-0.5 py-1 min-w-0 ${turn ? 'bg-white/10' : ''}`}
      style={{ marginTop: ARC[index], boxShadow: turn ? '0 0 0 2px #fcd34d, 0 0 16px rgba(252,211,77,.5)' : undefined }}>
      {seat.hands.map((h) => (
        <div key={h.hand} className={`flex flex-col items-center gap-0.5 ${turn && t.turn?.hand !== h.hand ? 'opacity-60' : ''}`}>
          {h.cards.length > 0 && <Fan cards={h.cards} size="sm" max={58} from={from} />}
          {h.cards.length > 0 && (
            <span className={`rounded px-1 text-[10px] leading-4 font-semibold ${settled && h.result ? (outcome(h).good ? 'bg-amber-300 text-zinc-900 gc-motion' : 'bg-black/35 text-white/80') : 'bg-black/35'}`}
              style={settled && h.result && outcome(h).good ? { animation: 'gc-pop .4s ease-out' } : undefined}>
              {settled && h.result ? outcome(h).text.replace('Blackjack! ', 'BJ ') : totalLabel(h)}
            </span>
          )}
        </div>
      ))}
      {/* The betting circle, printed on the felt. */}
      <span className={`relative grid place-items-end justify-center w-10 h-10 rounded-full ${won ? 'gc-motion' : ''}`}
        style={{ boxShadow: 'inset 0 0 0 1.5px rgba(253,230,138,.5)', animation: won ? 'gc-glow 1s ease-in-out infinite' : undefined }}>
        {staked > 0 && <span className="absolute bottom-1.5 gc-motion" style={{ animation: 'gc-drop .25s ease-out' }}><ChipStack amount={staked} size={24} label={fmt(staked)} /></span>}
      </span>
      {name ? (
        <span className={`max-w-full truncate text-[11px] ${seat.mine ? 'font-bold text-amber-200' : 'text-white/90'}`}>{name}</span>
      ) : canSit ? (
        <button type="button" onClick={onSit} disabled={sitting} aria-label={`Sit in seat ${seat.seat}`}
          className="h-6 px-2.5 rounded-full text-[11px] font-bold text-zinc-900 disabled:opacity-50"
          style={{ background: 'linear-gradient(180deg,#fde68a,#d97706)', boxShadow: '0 2px 0 #78350f' }}>
          {sitting ? '…' : moving ? 'Move' : 'Sit'}
        </button>
      ) : (
        <span className="text-[10px] text-white/35" aria-label={`Seat ${seat.seat}, empty`}>seat {seat.seat}</span>
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
  const [shaking, setShaking] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(id) }, [])
  const myBox = useRef<HTMLDivElement>(null)
  const { party, celebrate } = useCelebration()

  // The table in view: the one picked, else your own, else the liveliest one with a free seat.
  const busiest = [...bj.tables.filter((x) => !x.high)].sort((a, b) => b.seats.filter((s) => s.player).length - a.seats.filter((s) => s.player).length)
    .find((t) => t.seats.some((s) => !s.player)) ?? bj.tables[0]
  const t = bj.tables.find((x) => x.table === (view ?? mine?.table ?? busiest?.table)) ?? bj.tables[0]

  const now = Date.now() + skew
  const secs = (iso: string | null | undefined) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : 0)
  const atThis = !!t && mine?.table === t.table
  const mySeat = atThis && mine ? t.seats.find((s) => s.seat === mine.seat) : undefined
  const myHands = mySeat?.hands.filter((h) => h.mine) ?? []
  const inHand = bj.tables.some((x) => x.seats.some((s) => s.hands.some((h) => h.mine && h.result == null)))
  // The table's room: its limits and its chips (the high-limit table's are bigger).
  const caps = capsFor(state, !!t?.high)
  const chips = chipsFor(caps.min, caps.blackjack).slice(-6)

  // Once the hand is done the dealer's cards turn over one by one, and the results show after the last.
  const doneAt = t?.done_at ? Date.parse(t.done_at) : 0
  const dealer = !t ? [] : t.phase === 'done'
    ? t.dealer.flatMap((c, i) => (now >= doneAt + revealAt(i) ? [c] : i === 1 ? [-1] : []))
    : t.dealer
  const settled = !!t && t.phase === 'done' && now >= doneAt + revealAt(t.dealer.length - 1) + 300
  const dealerTotal = handTotal(dealer)
  const dealerLabel = !t || dealer.length === 0 ? '' : t.phase === 'playing' ? totalLabel({ cards: dealer, status: 'playing' })
    : dealer.length === 2 && dealerTotal.total === 21 && !dealer.includes(-1) ? 'Blackjack' : dealerTotal.total > 21 ? `Bust, ${dealerTotal.total}` : String(dealerTotal.total)

  const turnHand = t?.phase === 'playing' && t.turn ? t.seats.find((s) => s.seat === t.turn!.seat)?.hands.find((h) => h.hand === t.turn!.hand) : undefined
  const myTurn = !!turnHand?.mine && atThis
  const turnLeft = t?.turn ? Math.max(0, Date.parse(t.turn.ends_at) - now) : 0
  const mineDealt = myHands.length > 0 && myHands[0].status !== 'betting'
  const myStake = money(myHands.reduce((a, h) => a + h.bet, 0))
  const myBack = money(myHands.reduce((a, h) => a + (h.payout ?? 0), 0))

  // The sounds of the table, and your results: what changed since the last look at it (nothing on the first look).
  const snap = !t ? null : {
    table: t.table, round: t.round, phase: t.phase,
    cards: t.seats.reduce((a, s) => a + s.hands.reduce((b, h) => b + h.cards.length, 0), 0) + (t.phase === 'playing' ? t.dealer.length : 0),
    shown: dealer.filter((c) => c >= 0).length,
    bets: t.seats.reduce((a, s) => a + s.hands.length, 0),
    myTurn, left: myTurn ? secs(t.turn?.ends_at) : 99,
    busts: myHands.filter((h) => h.status === 'bust').length,
    settled: settled && mineDealt,
  }
  const sig = JSON.stringify(snap)
  const last = useRef<typeof snap>(null)
  useEffect(() => {
    const p = last.current, s = snap
    last.current = s
    if (!p || !s || p.table !== s.table) return
    const same = p.round === s.round
    const dealt = s.cards - (same ? p.cards : 0)
    for (let i = 0; i < Math.min(8, dealt); i++) sfx.deal(i * 0.13)
    if (same && s.phase === 'done' && s.shown > p.shown) { if (p.shown <= 1) sfx.flip(); else sfx.deal() }
    if (same && s.phase === 'betting' && s.bets > p.bets) sfx.chip()
    if (s.myTurn && !p.myTurn) sfx.turn()
    else if (s.myTurn && s.left <= 5 && s.left < p.left) sfx.tick()
    if (same && s.busts > p.busts) { sfx.bust(); setShaking(true); setTimeout(() => setShaking(false), 500) }
    if (same && s.settled && !p.settled) {
      const net = money(myBack - myStake), from = centerOf(myBox.current)
      if (net > 0 && myHands.some((h) => h.result === 'blackjack')) { sfx.win('big'); sfx.coins(14); celebrate({ tier: 'blackjack', title: 'BLACKJACK!', amount: `+${fmt(net)}`, from }) }
      else if (net > 0) { sfx.win('small'); sfx.coins(6); celebrate({ tier: 'small', title: 'You win!', amount: `+${fmt(net)}`, from }) }
      else if (net === 0) sfx.push()
      else sfx.lose()
    }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  // A move is locked from the moment it's sent until the table reads back different (or 3 s pass), so a quick
  // second tap can't hit twice.
  const moveSig = JSON.stringify([t?.phase, t?.round, t?.turn?.seat, t?.turn?.hand, myHands.map((h) => [h.cards.length, h.status, h.bet])])
  const locked = !!busy || (lock?.sig === moveSig && Date.now() - lock.at < 3000)

  if (!t) return null

  async function call(what: string, fn: string, args?: Record<string, unknown>) {
    if (busy) return false
    const before = moveSig
    setBusy(what); setNote(null)
    const { error } = await createClient().rpc(fn, args)
    setBusy(null)
    if (error) { setNote(refusal(error, WORDS)); return false }
    setLock({ sig: before, at: Date.now() })
    onPlayed()
    return true
  }
  const sit = async (table: number, seat: number) => { sfx.click(); if (await call(`sit:${table}:${seat}`, 'game_corner_bj_sit', { p_table: table, p_seat: seat })) setView(null) }
  const bet = async (amount: number) => { if (await call('bet', 'game_corner_bj_bet', { p_amount: amount })) { setLastBet(amount); setStake(0) } }
  const act = (move: 'hit' | 'stand' | 'double' | 'split') => { sfx.click(); return call(move, 'game_corner_bj_act', { p_action: move }) }

  // What's happening, in a line under the felt.
  let line: string
  if (t.phase === 'betting') {
    line = t.bets_close_at ? `Bets close in ${secs(t.bets_close_at)}s`
      : !t.seats.some((s) => s.player) ? 'Nobody’s here yet. Take a seat.'
      : atThis ? 'Place a bet to start the next hand.' : 'Waiting for someone to bet.'
  } else if (t.phase === 'playing') {
    line = myTurn ? `Your turn · ${secs(t.turn?.ends_at)}s` : `${turnHand?.player ?? 'Someone'}’s turn · ${secs(t.turn?.ends_at)}s`
  } else {
    line = !settled ? 'The dealer plays…'
      : `${dealerLabel === 'Blackjack' ? 'Dealer has blackjack.' : dealerTotal.total > 21 ? `Dealer busts with ${dealerTotal.total}.` : `Dealer has ${dealerTotal.total}.`} Next hand in ${secs(t.next_at)}s`
  }
  const dealtShare = Math.min(1, Math.max(0, (312 - t.shoe_left) / 312))

  return (
    <LuxeDeck.Provider value={!!t.high}>
    <div className="space-y-4">
      {party}
      <nav aria-label="Tables" className={`grid gap-1.5 ${bj.tables.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {bj.tables.map((x) => {
          const n = x.seats.filter((s) => s.player).length, on = x.table === t.table
          return (
            <button key={x.table} type="button" onClick={() => { if (!on) sfx.click(); setView(x.table) }} aria-pressed={on}
              className={`relative rounded-xl border px-2 py-1.5 text-left min-w-0 ${on ? (x.high ? 'border-amber-500 text-amber-100' : 'border-ink bg-ink text-white') : x.high ? 'border-amber-500/60 bg-card' : 'border-card-border bg-card'}`}
              style={on && x.high ? { background: 'linear-gradient(180deg,#3b0a17,#1c0509)' } : undefined}>
              <span className="block text-sm font-semibold truncate">
                {x.high ? 'High limit' : `Table ${x.table}`}{mine?.table === x.table && <span className="absolute top-1 right-1.5 text-[10px] text-signal" aria-label="(yours)">●</span>}
              </span>
              <span className={`block text-[11px] truncate ${on ? 'opacity-70' : 'text-muted'}`}>{n}/5 · {n === 0 ? 'empty' : x.phase === 'betting' ? 'betting' : 'playing'}</span>
            </button>
          )
        })}
      </nav>

      {/* The table: a padded leather rail, stitched, round green velvet; at the high-limit table black leather and
          burgundy velvet. */}
      <section aria-label={t.high ? 'The high-limit table' : `Table ${t.table}`} className="relative p-[11px]" style={{
        borderRadius: TABLE_SHAPE,
        backgroundColor: t.high ? '#0c0a09' : '#2b1a12',
        // The main tables' leather is scuffed and grainy; the high-limit table's is glossy black, without a mark.
        backgroundImage: t.high
          ? 'linear-gradient(180deg, rgba(255,255,255,.18), transparent 30%), radial-gradient(ellipse at 50% 8%, rgba(255,255,255,.22), transparent 45%), linear-gradient(180deg,#3f3f46,#0c0a09)'
          : `${SCUFFS}, ${NOISE}, radial-gradient(ellipse at 50% 8%, rgba(255,235,205,.25), transparent 45%), linear-gradient(180deg,#5b3a29,#2b1a12)`,
        boxShadow: '0 14px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,235,205,.3), inset 0 -3px 6px rgba(0,0,0,.6)',
      }}>
        <div className="absolute inset-[4px] pointer-events-none" style={{ borderRadius: TABLE_SHAPE, border: `1.5px dashed ${t.high ? 'rgba(243,210,122,.65)' : 'rgba(255,235,205,.3)'}` }} aria-hidden />
        <div className="relative px-3 pt-3 pb-5 text-white overflow-hidden" style={{ ...(t.high ? VELVET_RED : VELVET), borderRadius: TABLE_SHAPE, boxShadow: 'inset 0 0 0 2px #c9a227, inset 0 0 36px rgba(0,0,0,.6)' }}>
          {/* The discard tray (fuller as the shoe empties) and the shoe. */}
          <div className="absolute left-3 top-3 w-9 h-12 rounded-md p-1 flex items-end" aria-label={`${Math.round(dealtShare * 100)}% of the shoe dealt`} style={{ background: 'rgba(0,0,0,.35)', boxShadow: 'inset 0 0 0 1px rgba(253,230,138,.35)' }}>
            <div className="w-full rounded-[2px]" style={{ height: `${8 + dealtShare * 80}%`, ...(t.high ? BACK_LUXE : BACK), boxShadow: `0 -1px 0 ${t.high ? '#e5c158' : '#fff'}` }} />
          </div>
          <div className="absolute right-3 top-3 w-10 h-12 rounded-md" aria-hidden style={{ background: 'linear-gradient(160deg,#52525b,#18181b)', boxShadow: `0 3px 6px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.25)${t.high ? ', inset 0 0 0 1px #e5c158' : ''}` }}>
            <div className="absolute left-1.5 right-1 top-1.5 h-6 rounded-sm" style={{ ...(t.high ? BACK_LUXE : BACK), transform: 'skewX(-10deg)', boxShadow: `0 0 0 1px ${t.high ? '#e5c158' : '#fff'}` }} />
            <div className="absolute inset-x-0 bottom-1 text-center text-[6px] text-white/50 tracking-[0.2em]">SHOE</div>
          </div>

          <div className="flex flex-col items-center gap-1 min-h-[92px]">
            {t.high && <span className="text-[11px] font-black tracking-[0.3em] -mb-1" style={GOLD_TEXT}>★ HIGH LIMIT ★</span>}
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">Dealer</span>
            {dealer.length > 0 ? <Fan cards={dealer} size="md" from={[110, -10]} turnAt={t.phase === 'done' ? 1 : undefined} />
              : <div className="h-[57px] w-10 rounded-[5px] border border-dashed border-white/20" aria-hidden />}
            {dealerLabel && <span className="rounded bg-black/35 px-1.5 text-xs leading-5 font-semibold">{dealerLabel}</span>}
          </div>

          {/* What's printed on the felt, in arcs. */}
          <svg viewBox="0 0 300 58" className="block w-full -mt-1" aria-label="Blackjack pays 3 to 2. Dealer stands on all 17s." role="img">
            <path id={`bj-a1-${t.table}`} d="M24 8 Q150 52 276 8" fill="none" />
            <path id={`bj-a2-${t.table}`} d="M46 22 Q150 64 254 22" fill="none" />
            <text fontSize="11.5" fontWeight="800" letterSpacing="2.5" fill="#fde68a" fillOpacity=".85"><textPath href={`#bj-a1-${t.table}`} startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
            <text fontSize="7.5" letterSpacing="1.6" fill="#fff" fillOpacity=".55"><textPath href={`#bj-a2-${t.table}`} startOffset="50%" textAnchor="middle">DEALER STANDS ON ALL 17s</textPath></text>
            <path d="M8 34 Q150 84 292 34" stroke="#fde68a" strokeOpacity=".3" fill="none" />
          </svg>

          <div className="grid grid-cols-5 gap-1 items-start">
            {t.seats.map((s, i) => (
              <Spot key={s.seat} seat={s} index={i} t={t} settled={settled}
                canSit={state.open && !inHand} moving={!!mine} sitting={busy === `sit:${t.table}:${s.seat}`} onSit={() => sit(t.table, s.seat)} />
            ))}
          </div>
        </div>
      </section>

      <p aria-live="polite" className={`text-center font-display font-semibold ${myTurn ? 'text-signal text-lg' : ''}`}>{line}</p>

      {atThis && mySeat ? (
        <section className="rounded-2xl border border-card-border bg-card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-semibold">{t.high ? 'High limit' : `Table ${t.table}`} · seat {mySeat.seat}</h2>
            <button type="button" onClick={() => { sfx.click(); call('leave', 'game_corner_bj_leave') }} disabled={!!busy} className="text-xs text-muted hover:text-ink underline">Leave table</button>
          </div>

          {mineDealt && (
            <div ref={myBox} className="flex flex-wrap justify-center gap-3 rounded-xl py-2" style={{ ...(t.high ? VELVET_RED : VELVET), boxShadow: 'inset 0 0 0 1px #c9a227, inset 0 0 20px rgba(0,0,0,.5)' }}>
              {myHands.map((h) => {
                const active = myTurn && t.turn?.hand === h.hand
                return (
                  <div key={h.hand} className="flex flex-col items-center gap-1 rounded-xl p-2 text-white gc-motion"
                    style={{ boxShadow: active ? '0 0 0 2px #fcd34d, 0 0 14px rgba(252,211,77,.5)' : undefined, animation: shaking && h.status === 'bust' ? 'gc-shake .45s ease-in-out' : undefined }}>
                    <Fan cards={h.cards} size="lg" max={myHands.length > 1 ? 130 : 220} from={[140, -260]} />
                    <span className="text-sm font-semibold">{totalLabel(h)}</span>
                    <span className="text-xs text-white/70">Bet <span className="font-mono">{fmt(h.bet)}</span>{h.doubled ? ' · doubled' : ''}</span>
                    {settled && h.result && <span className={`text-sm gc-motion ${outcome(h).good ? 'text-amber-300 font-semibold' : 'text-white/60'}`} style={{ animation: 'gc-pop .4s ease-out' }}>{outcome(h).text}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {t.phase === 'betting' && myHands.length === 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 min-h-12">
                {stake > 0 ? <><ChipStack amount={stake} size={30} /><span className="text-sm">Your bet <b className="font-mono">{fmt(stake)}</b></span></> : <span className="text-sm text-muted">Tap chips to make your bet.</span>}
              </div>
              <div className="flex flex-wrap justify-center gap-1 rounded-xl p-1.5 mx-auto w-fit" style={t.high ? RAIL_LUXE : RAIL_WORN} role="group" aria-label="Chips">
                {chips.map((c) => (
                  <button key={c} type="button" aria-label={`Add ${fmt(c)}`} disabled={money(stake + c) > caps.blackjack}
                    onClick={() => { sfx.chip(); setStake((s) => Math.min(caps.blackjack, money(s + c))) }}
                    className="rounded-full transition-transform hover:-translate-y-1 disabled:opacity-40 disabled:hover:translate-y-0">
                    <Chip value={c} size={40} label={fmt(c)} />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { sfx.click(); setStake(0) }} disabled={stake === 0} className="h-12 px-4 rounded-xl border border-card-border text-sm disabled:opacity-40">Clear</button>
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
              <p className="text-center text-[11px] text-muted">{fmt(caps.min)} to {fmt(caps.blackjack)} a hand{t.high ? ', at the high-limit table' : ''}.</p>
            </div>
          )}

          {t.phase === 'betting' && myHands.length > 0 && (
            <div className="text-center space-y-1">
              <p className="text-sm">Your bet <b className="font-mono">{fmt(myStake)}</b>. {t.bets_close_at ? 'Dealing when the others have bet, or the time’s up.' : ''}</p>
              <button type="button" onClick={() => { sfx.click(); call('unbet', 'game_corner_bj_unbet') }} disabled={locked} className="text-xs text-muted hover:text-ink underline">Take it back</button>
            </div>
          )}

          {myTurn && turnHand && (
            <div className="space-y-2">
              <div className="h-1.5 rounded-full bg-card-border overflow-hidden" aria-hidden>
                <div className="h-full transition-[width] duration-300 ease-linear" style={{ width: `${Math.min(100, turnLeft / 200)}%`, background: turnLeft < 6000 ? '#ef4444' : 'var(--signal)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => act('hit')} disabled={locked} className="h-12 rounded-xl bg-ink text-white font-display font-bold text-lg disabled:opacity-50 active:translate-y-px">Hit</button>
                <button type="button" onClick={() => act('stand')} disabled={locked} className="h-12 rounded-xl bg-signal text-ink font-display font-bold text-lg disabled:opacity-50 active:translate-y-px">Stand</button>
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
    </LuxeDeck.Provider>
  )
}
