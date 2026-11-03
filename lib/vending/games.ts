/*
 * The card games the machine sells: Pokémon, and the One Piece Card Game (v96).
 * A set's game follows from its code (One Piece sets are op01, op02, ...), so
 * nothing else needs to carry it. A plain module, not a client one, so server
 * pages and client components can both call it.
 *
 * Rarity letters (vending_cards.rarity) are shared: C, U and R mean the same in
 * both games, H is Pokémon's holo rare and One Piece's Super Rare (SR), S the
 * secret rare (SEC). One Piece adds L (a Leader) and P (a Parallel: an
 * alternate art, or an SP card).
 */

export type Game = 'pkm' | 'op'

export const GAMES: { id: Game; label: string }[] = [
  { id: 'pkm', label: 'Pokémon' },
  { id: 'op', label: 'One Piece' },
]

/** A set's game, from its code; a card's from its set code or image path (/cards/op01-001.webp). */
export function gameOf(setCodeOrImage: string | null | undefined): Game {
  const s = setCodeOrImage ?? ''
  return /^op\d/i.test(s) || /\/cards\/op\d/i.test(s) ? 'op' : 'pkm'
}

const NAMES: Record<Game, Record<string, string>> = {
  pkm: { C: 'Common', U: 'Uncommon', R: 'Rare', H: 'Holo Rare', S: 'Secret Rare' },
  op: { C: 'Common', U: 'Uncommon', R: 'Rare', H: 'Super Rare', S: 'Secret Rare', L: 'Leader', P: 'Parallel' },
}

/** A rarity's name in its game ("Holo Rare" for Pokémon's H, "Super Rare" for One Piece's). */
export function rarityName(rarity: string, setCodeOrImage?: string | null): string {
  return NAMES[gameOf(setCodeOrImage)][rarity] ?? rarity
}

/** The pulls worth a fanfare: a holo or Super Rare, a secret rare, or a One Piece parallel. */
export const isHit = (rarity: string) => rarity === 'H' || rarity === 'S' || rarity === 'P'

/**
 * Card numbers in binder order: 1, 2 ... 10, then a card's parallels after it
 * (001, 001_p1, 002). Numbers aren't always plain digits (One Piece's
 * parallels, and SP reprints from other sets, which go last).
 */
export function compareCardNumbers(a: string, b: string): number {
  const key = (n: string) => {
    const m = /^(\d+)(.*)$/.exec(n)
    return m ? { other: 0, num: Number(m[1]), rest: m[2] } : { other: 1, num: 0, rest: n }
  }
  const x = key(a), y = key(b)
  return x.other - y.other || x.num - y.num || x.rest.localeCompare(y.rest)
}
