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
export default function HoloMark({ rarity }: { rarity: string }) {
  if (rarity !== 'H' && rarity !== 'S') return null
  const secret = rarity === 'S'
  return (
    <span
      className={`pointer-events-none absolute -top-1 -left-1 rounded-full text-[9px] font-bold px-1 py-0.5 shadow leading-none ${
        secret ? 'bg-fuchsia-500 text-white' : 'bg-amber-400 text-ink'
      }`}
      title={secret ? 'Secret rare' : 'Holo rare'}
    >
      {secret ? '★' : '✦'}
    </span>
  )
}

/** The same distinction for a screen reader, which cannot see the badge. */
export function rarityLabel(rarity: string): string {
  return rarity === 'S' ? ', secret rare' : rarity === 'H' ? ', holo' : ''
}
