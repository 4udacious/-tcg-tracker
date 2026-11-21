/*
 * Blackjack cards as the tables send them (v116): 0-51, rank c % 13 (0 ace, 1-8 two to nine, 9-12 ten to king),
 * suit c / 13 (spades, hearts, diamonds, clubs); -1 is the dealer's face-down card. Totals here match
 * game_corner_bj_total: aces count 11 where that doesn't bust the hand.
 */
import type { BjHand } from './state'

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUITS = ['♠', '♥', '♦', '♣']
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
export const RANK_NAMES = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King']

export const rankOf = (c: number) => c % 13
export const suitOf = (c: number) => Math.floor(c / 13) % 4
export const isRed = (c: number) => suitOf(c) === 1 || suitOf(c) === 2
/** What a card counts: an ace 1 (or 11, see handTotal), a picture 10. */
export const valueOf = (c: number) => Math.min(10, rankOf(c) + 1)
export const cardName = (c: number) => (c < 0 ? 'face-down card' : `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`)

/** A hand's best total, and whether an ace in it is counting 11 (a soft total). Face-down cards don't count. */
export function handTotal(cards: number[]): { total: number; soft: boolean } {
  let hard = 0, ace = false
  for (const c of cards) {
    if (c < 0) continue
    hard += valueOf(c)
    if (rankOf(c) === 0) ace = true
  }
  const soft = ace && hard + 10 <= 21
  return { total: soft ? hard + 10 : hard, soft }
}

/** What a hand shows by its cards: "Blackjack", "Bust", a total, or both totals while a soft hand is still in play. */
export function totalLabel(h: Pick<BjHand, 'cards' | 'status'>): string {
  if (h.status === 'blackjack') return 'Blackjack'
  if (h.cards.length === 0) return ''
  const { total, soft } = handTotal(h.cards)
  if (total > 21) return 'Bust'
  return soft && total < 21 && h.status === 'playing' ? `${total - 10} or ${total}` : String(total)
}

/** A split is a pair (any two ten-cards count), as a seat's first hand, once. */
export function canSplit(hands: BjHand[], h: BjHand): boolean {
  return h.hand === 1 && h.cards.length === 2 && valueOf(h.cards[0]) === valueOf(h.cards[1]) && !hands.some((o) => o.hand === 2)
}

export const canDouble = (h: BjHand) => h.cards.length === 2

/**
 * When the page turns over each of the dealer's cards once the hand is done (ms after done_at): the first was
 * already showing, the face-down one turns at 0.4 s, each card drawn after it 0.8 s apart. game_corner_bj_finish
 * leaves the results up long enough after the last.
 */
export const revealAt = (i: number) => (i <= 0 ? 0 : 400 + (i - 1) * 800)
