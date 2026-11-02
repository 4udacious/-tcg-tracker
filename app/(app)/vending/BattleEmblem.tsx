'use client'

/**
 * The Champion's Emblem (v87): a member's proof they finished the battle game,
 * the Kanto Elite Four, Red and Alex's last battle, with the team they did it
 * with (their Hall of Fame team). Drawn at a card's proportions so it stands on
 * a showcase shelf like one; everything inside scales with its width.
 */
export interface BattleEmblemData {
  /** The member's display name (or username). */
  name: string
  /** Up to six, in Hall of Fame order. */
  team: { id: number; name: string; level: number; shiny: boolean }[]
  earned_at: string
  /** Where it stands in the showcase, 0-11, or null when it isn't on display. */
  showcase_slot: number | null
}

const sprite = (m: BattleEmblemData['team'][number]) => (m.shiny ? `/rpg/a/shiny/${m.id}.gif` : `/rpg/a/${m.id}.gif`)
/** The usual sprite, for a shiny one that didn't load (even if it failed before the page was interactive). */
const plain = (img: HTMLImageElement, id: number) => { const n = `/rpg/a/${id}.gif`; if (!img.src.endsWith(n)) img.src = n }

export default function BattleEmblem({ emblem, className = '' }: { emblem: BattleEmblemData; className?: string }) {
  const date = new Date(emblem.earned_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div
      className={`relative w-full aspect-[245/342] rounded-[6%] p-[4%] shadow-lg ${className}`}
      style={{ containerType: 'inline-size', background: 'linear-gradient(145deg, #fef3c7 0%, #f59e0b 28%, #92400e 55%, #fbbf24 78%, #fef3c7 100%)' }}
      role="img"
      aria-label={`Champion's Emblem: ${emblem.name}, with ${emblem.team.map((m) => `${m.name} Lv ${m.level}`).join(', ')}. Earned ${date}.`}
    >
      <div
        className="relative h-full w-full rounded-[5%] overflow-hidden flex flex-col items-center text-center"
        style={{ background: 'radial-gradient(120% 70% at 50% 0%, #1e3a8a 0%, #0f172a 58%, #020617 100%)', boxShadow: 'inset 0 0 0 1px rgba(253,230,138,0.45)' }}
      >
        {/* The crest: a star in a laurel. */}
        <svg viewBox="0 0 48 30" className="w-[30%] mt-[5%]" aria-hidden>
          <path d="M8 26C3 20 3 11 9 5M40 26c5-6 5-15-1-21" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} fill="#fbbf24">
              <ellipse cx={6 + i * 0.6} cy={22 - i * 5} rx="2.6" ry="1.3" transform={`rotate(${-50 + i * 12} ${6 + i * 0.6} ${22 - i * 5})`} />
              <ellipse cx={42 - i * 0.6} cy={22 - i * 5} rx="2.6" ry="1.3" transform={`rotate(${50 - i * 12} ${42 - i * 0.6} ${22 - i * 5})`} />
            </g>
          ))}
          <path d="M24 3l3.4 7 7.6 1-5.5 5.3 1.3 7.6L24 20.3l-6.8 3.6 1.3-7.6L13 11l7.6-1z" fill="#fde68a" stroke="#b45309" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        <p className="font-display font-bold tracking-[0.12em] text-amber-300 leading-none mt-[2%]" style={{ fontSize: '10.5cqw' }}>
          CHAMPION
        </p>
        <p className="font-mono text-amber-100/70 leading-tight mt-[2%] px-[6%]" style={{ fontSize: '4.6cqw' }}>
          KANTO LEAGUE · RED · ALEX
        </p>
        <p className="font-semibold text-white leading-tight mt-[3%] px-[6%] w-full truncate" style={{ fontSize: '7.5cqw' }}>
          {emblem.name}
        </p>

        {/* The team that did it. */}
        <div className="grid grid-cols-3 gap-[3%] w-full px-[8%] mt-[3%]">
          {emblem.team.map((m, i) => (
            <div key={i} className="flex flex-col items-center rounded-[12%] bg-white/[0.06] pt-[4%] pb-[5%]" style={{ boxShadow: 'inset 0 0 0 1px rgba(253,230,138,0.18)' }}>
              {/* A shiny without its own sprite falls back to the usual one. */}
              <img src={sprite(m)} alt="" className="w-[70%] aspect-square object-contain [image-rendering:pixelated]" loading="lazy"
                   onError={(e) => plain(e.currentTarget, m.id)} ref={(el) => { if (el?.complete && el.naturalWidth === 0) plain(el, m.id) }} />
              <span className="font-mono text-amber-100/80 leading-none mt-[4%]" style={{ fontSize: '3.9cqw' }}>Lv {m.level}</span>
            </div>
          ))}
        </div>

        <p className="mt-auto mb-[5%] pt-[2%] font-mono text-amber-200/60 leading-none" style={{ fontSize: '4.2cqw' }}>
          HALL OF FAME · {date}
        </p>
      </div>
    </div>
  )
}
