/*
 * What the Game Corner page reads (game_corner_state, v115) and the words for
 * what its functions refuse. Amounts arrive as numeric strings often enough
 * that everything goes through num() before it's compared or added.
 */
import { num } from '../vending/tokens'

export type Reel = 'SEVEN' | 'BAR' | 'PIKACHU' | 'BALL' | 'CHERRY' | 'BLANK'

export type SlotMachine = {
  machine: number
  player: string | null
  avatar: string | null
  mine: boolean
  reels: Reel[] | null        // the 3x3 window, reel by reel: reel 1 top, middle, bottom, then reels 2 and 3
  lines: number[] | null       // the paylines that paid (1-3 the rows, 4 and 5 the diagonals)
  bet: number | null
  win: number | null
  at: string | null
  spins: number
}

export type RouletteBet = { kind: BetKind; pick: number | null; amount: number; player: string; mine: boolean }
export type BetKind = 'number' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen' | 'column'

export type RouletteState = {
  round: number
  betting: boolean
  bets_close_at: string
  round_ends_at: string
  result: number | null
  bets: RouletteBet[]
  last: { round: number; result: number; stake: number; payout: number } | null
  history: number[]
}

/**
 * A blackjack hand (v116). Cards are 0-51: rank c % 13 (0 ace, 1-8 two to nine, 9-12 ten to king), suit c / 13
 * (spades, hearts, diamonds, clubs); -1 is the dealer's face-down card.
 */
export type BjHand = {
  hand: 1 | 2                 // 2: the second hand of a split
  player: string
  mine: boolean
  cards: number[]
  bet: number                 // doubled, once doubled
  doubled: boolean
  split: boolean
  status: 'betting' | 'playing' | 'stood' | 'bust' | 'blackjack'
  result: 'blackjack' | 'win' | 'push' | 'lose' | null   // once paid
  payout: number | null
}

export type BjSeat = { seat: number; player: string | null; avatar: string | null; mine: boolean; hands: BjHand[] }

export type BjTable = {
  table: number
  phase: 'betting' | 'playing' | 'done'
  round: number
  bets_close_at: string | null   // betting: when it deals (null until someone bets)
  turn: { seat: number; hand: number; ends_at: string } | null
  dealer: number[]
  done_at: string | null         // done: when the dealer played
  next_at: string | null         // done: when the next hand's bets open
  shoe_left: number
  seats: BjSeat[]
}

export type BlackjackState = { mine: { table: number; seat: number } | null; tables: BjTable[] }

export type CornerState = {
  now: string
  open: boolean
  caps: { min: number; slots: number; roulette: number; blackjack: number }
  balance: number
  slots: SlotMachine[]
  roulette: RouletteState
  blackjack: BlackjackState
}

/** The state as read, with every amount a number. */
export function normalize(raw: CornerState): CornerState {
  return {
    ...raw,
    caps: { min: num(raw.caps.min), slots: num(raw.caps.slots), roulette: num(raw.caps.roulette), blackjack: num(raw.caps.blackjack) },
    balance: num(raw.balance),
    slots: (raw.slots ?? []).map((m) => ({ ...m, bet: m.bet == null ? null : num(m.bet), win: m.win == null ? null : num(m.win) })),
    roulette: {
      ...raw.roulette,
      bets: (raw.roulette.bets ?? []).map((b) => ({ ...b, amount: num(b.amount) })),
      last: raw.roulette.last ? { ...raw.roulette.last, stake: num(raw.roulette.last.stake), payout: num(raw.roulette.last.payout) } : null,
    },
    blackjack: {
      mine: raw.blackjack?.mine ?? null,
      tables: (raw.blackjack?.tables ?? []).map((t) => ({
        ...t,
        dealer: t.dealer ?? [],
        seats: (t.seats ?? []).map((s) => ({
          ...s,
          hands: (s.hands ?? []).map((h) => ({ ...h, cards: h.cards ?? [], bet: num(h.bet), payout: h.payout == null ? null : num(h.payout) })),
        })),
      })),
    },
  }
}

const REFUSALS: Record<string, string> = {
  members_only: 'The Game Corner is for members.',
  closed: 'The Game Corner is closed for now.',
  bet_too_small: 'That bet is under the minimum.',
  bet_too_big: 'That goes over the table limit.',
  not_enough_tokens: 'Not enough tokens for that bet.',
  not_seated: 'Sit at a machine first.',
  seat_taken: 'Someone is playing that machine.',
  bets_closed: 'No more bets: the wheel is spinning.',
  bad_bet: 'That bet isn’t on the board.',
  already_bet: 'You’ve already bet on this hand.',
  in_hand: 'Finish the hand you’re in first.',
  not_your_turn: 'It isn’t your turn.',
  cant_double: 'You can double down only on your first two cards.',
  cant_split: 'You can split only a pair, once.',
  no_such_seat: 'That seat isn’t there.',
}

/** What a refused call means, in words; `words` replaces the wording for a game. */
export function refusal(error: { message?: string } | null | undefined, words: Record<string, string> = {}): string {
  const m = (error?.message ?? '').trim()
  const all = { ...REFUSALS, ...words }
  // The code is the whole message; failing that, the longest code inside it ('bets_closed' before 'closed').
  const code = all[m] ? m : Object.keys(all).sort((a, b) => b.length - a.length).find((k) => m.includes(k))
  return code ? all[code] : 'That didn’t go through. Try again.'
}

/** Single-zero wheel: the red numbers, and the pockets in order round the wheel. */
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
export const colorOf = (n: number) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')
