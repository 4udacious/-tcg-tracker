import { gameOf, type Game } from './games'

/*
 * Eras: how the Trainer tab shelves its binders and orders its packs. Each era
 * is one shelf, its sets in release order. Pokémon's are its publishers' eras:
 * Wizards of the Coast (1999 to 2003, Base Set to Skyridge), then the EX era
 * that followed. One Piece has no eras, so its two lines of sets stand in:
 * the main Booster Packs (OP-xx) and the Extra Boosters (EB-xx). A plain module,
 * so server and client code can both use it.
 *
 * A set that isn't listed (a new one) still lands somewhere: by its code's
 * prefix (ex*, op*, eb*), or else on its game's "More sets" shelf, at the end.
 */

export interface Era {
  id: string
  game: Game
  name: string
  /** Under the name: the years, or what the shelf holds. */
  sub: string
  /** Set codes, in release order. */
  sets: string[]
}

export const ERAS: Era[] = [
  {
    id: 'wotc', game: 'pkm', name: 'Wizards of the Coast', sub: '1999–2003',
    sets: ['base1', 'base2', 'base3', 'base4', 'base5', 'gym1', 'gym2', 'neo1', 'neo2', 'si1', 'neo3', 'neo4', 'base6', 'ecard1', 'ecard2', 'ecard3'],
  },
  { id: 'ex', game: 'pkm', name: 'EX', sub: '2003–2007', sets: ['ex1'] },
  { id: 'op', game: 'op', name: 'Booster Packs', sub: 'OP-01 onward', sets: ['op01', 'op02', 'op03', 'op04', 'op05', 'op06', 'op07', 'op08'] },
  { id: 'eb', game: 'op', name: 'Extra Boosters', sub: 'EB-01 onward', sets: ['eb01', 'eb02', 'eb03'] },
]

const MORE: Record<Game, Era> = {
  pkm: { id: 'pkm-more', game: 'pkm', name: 'More sets', sub: 'Pokémon', sets: [] },
  op: { id: 'op-more', game: 'op', name: 'More sets', sub: 'One Piece', sets: [] },
}

/** A set's era: the one that lists it, else by its code's prefix, else its game's "More sets". */
export function eraOf(setCode: string): Era {
  const listed = ERAS.find((e) => e.sets.includes(setCode))
  if (listed) return listed
  const prefix = /^[a-z]+/i.exec(setCode)?.[0]?.toLowerCase()
  return ERAS.find((e) => e.id === prefix) ?? MORE[gameOf(setCode)]
}

/** Sorts sets as the shelves hold them: Pokémon before One Piece, era by era, then release order (an unlisted set last, by code). */
export function compareSets(a: string, b: string): number {
  const rank = (code: string) => {
    const era = eraOf(code), i = ERAS.indexOf(era)
    return { game: era.game === 'pkm' ? 0 : 1, era: i < 0 ? ERAS.length : i, at: era.sets.includes(code) ? era.sets.indexOf(code) : Infinity }
  }
  const x = rank(a), y = rank(b)
  return x.game - y.game || x.era - y.era || x.at - y.at || a.localeCompare(b)
}

/** The shelves for some sets: each era that has any, in order, with its sets in release order. */
export function shelvesOf<T extends { set_code: string }>(sets: T[]): { era: Era; sets: T[] }[] {
  const by = new Map<string, { era: Era; sets: T[] }>()
  for (const s of [...sets].sort((a, b) => compareSets(a.set_code, b.set_code))) {
    const era = eraOf(s.set_code)
    const got = by.get(era.id)
    if (got) got.sets.push(s)
    else by.set(era.id, { era, sets: [s] })
  }
  return [...by.values()]
}
