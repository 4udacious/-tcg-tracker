import { isHit, rarityName } from '@/lib/vending/games'

/**
 * Marks a holo or secret rare on a card thumbnail.
 *
 * Jungle, Fossil and Team Rocket each print about sixteen cards twice - once
 * holo, once not - under the same name. At thumbnail size the two are
 * indistinguishable, so anywhere cards are shown as a grid of art and picked
 * from needs this, or you cannot tell which one you are choosing.
 *
 * Positioned top-left by convention, leaving the opposite corner for a count
 * or a grade.
 */
export default function HoloMark({ rarity, setCode }: { rarity: string; setCode?: string | null }) {
  if (!isHit(rarity)) return null
  const secret = rarity === 'S', parallel = rarity === 'P'
  return (
    <span
      className={`pointer-events-none absolute -top-1 -left-1 rounded-full text-[9px] font-bold px-1 py-0.5 shadow leading-none ${
        secret ? 'bg-fuchsia-500 text-white' : parallel ? 'bg-sky-400 text-ink' : 'bg-amber-400 text-ink'
      }`}
      title={rarityName(rarity, setCode)}
    >
      {secret ? '★' : parallel ? '◆' : '✦'}
    </span>
  )
}

/** The same distinction for a screen reader, which cannot see the badge (One Piece's H is a Super Rare). */
export function rarityLabel(rarity: string, setCode?: string | null): string {
  return isHit(rarity) ? `, ${rarityName(rarity, setCode).toLowerCase()}` : ''
}
