/**
 * Battle supplies are drawn rather than uploaded: there are only a handful,
 * the battle game knows them by key, and an SVG stays crisp both at the size
 * of a bundle's contents row and filling an item's tile. Anything without a
 * drawing of its own (a bundle, or an item added later) gets the bag.
 */
export default function SupplyIcon({ supplyKey, className }: { supplyKey: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {supplyKey === 'poke_ball' || supplyKey === 'great_ball' || supplyKey === 'ultra_ball' ? (
        <Ball kind={supplyKey === 'great_ball' ? 'great' : supplyKey === 'ultra_ball' ? 'ultra' : 'poke'} />
      ) : supplyKey === 'potion' ? (
        <Bottle body="#a855f7" edge="#6b21a8" />
      ) : supplyKey === 'super_potion' ? (
        <Bottle body="#ec4899" edge="#9d174d" />
      ) : supplyKey === 'hyper_potion' ? (
        <Bottle body="#d946ef" edge="#86198f" />
      ) : supplyKey === 'full_heal' ? (
        <>
          <rect x="9.5" y="1.5" width="5" height="2.5" rx="0.8" fill="#4b5563" />
          <path d="M14.5 2.75h3" stroke="#4b5563" strokeWidth="1.4" strokeLinecap="round" />
          <rect x="10.25" y="4" width="3.5" height="3" fill="#9ca3af" />
          <path d="M6.5 10a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3V19a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3Z" fill="#facc15" stroke="#a16207" strokeWidth="1.2" />
          <path d="M12 11.5v6M9 14.5h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : STONES[supplyKey] ? (
        <Stone {...STONES[supplyKey]} />
      ) : supplyKey === 'linking_cord' ? (
        <>
          <path d="M5 17c0-6 5-6 7-6s7 0 7-6" fill="none" stroke="#1d4ed8" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M5 17c0-6 5-6 7-6s7 0 7-6" fill="none" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" strokeDasharray="1.5 2" />
          <rect x="2.5" y="16.5" width="5" height="5" rx="1.2" fill="#e5e7eb" stroke="#374151" strokeWidth="1" />
          <rect x="16.5" y="2.5" width="5" height="5" rx="1.2" fill="#e5e7eb" stroke="#374151" strokeWidth="1" />
        </>
      ) : supplyKey === 'dragon_scale' ? (
        <>
          <path d="M12 2.5c4.5 2.5 7 6.5 7 11a7 7 0 0 1-14 0c0-4.5 2.5-8.5 7-11Z" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M12 6.5c2.6 1.8 4 4.4 4 7.2a4 4 0 0 1-8 0c0-2.8 1.4-5.4 4-7.2Z" fill="#bfdbfe" opacity="0.8" />
        </>
      ) : supplyKey === 'rare_candy' ? (
        <>
          <path d="M5.5 12 2 8.5v7Z M18.5 12 22 8.5v7Z" fill="#93c5fd" stroke="#1e3a8a" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="6.5" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="3.6" fill="#93c5fd" />
          <circle cx="10.2" cy="9.8" r="1.2" fill="#fff" />
        </>
      ) : supplyKey === 'revive' ? (
        <>
          <path d="M12 2 21 12 12 22 3 12Z" fill="#facc15" stroke="#a16207" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M12 6.5 16.5 12 12 17.5 7.5 12Z" fill="#fef9c3" />
        </>
      ) : supplyKey === 'max_revive' ? (
        <>
          <path d="M12 2 21 12 12 22 3 12Z" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M12 6.5 16.5 12 12 17.5 7.5 12Z" fill="#fde68a" />
          <path d="M19 1.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" fill="#fff" stroke="#92400e" strokeWidth="0.5" />
        </>
      ) : (
        <>
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="#92400e" strokeWidth="1.6" />
          <rect x="3" y="8" width="18" height="13" rx="2.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
          <path d="M3 12.5h18" stroke="#92400e" strokeWidth="1.2" />
          <rect x="10" y="11" width="4" height="3" rx="0.8" fill="#fde68a" stroke="#92400e" strokeWidth="0.8" />
        </>
      )}
    </svg>
  )
}

function Ball({ kind }: { kind: 'poke' | 'great' | 'ultra' }) {
  return (
    <>
      <circle cx="12" cy="12" r="10" fill="#fff" stroke="#111" strokeWidth="1.5" />
      <path d="M2 12a10 10 0 0 1 20 0Z" fill={kind === 'great' ? '#2563eb' : kind === 'ultra' ? '#27272a' : '#e3263a'} stroke="#111" strokeWidth="1.5" />
      {kind === 'great' && (
        <path d="M6.2 6.6 8.8 9.2M17.8 6.6 15.2 9.2" stroke="#e3263a" strokeWidth="2.2" strokeLinecap="round" />
      )}
      {kind === 'ultra' && (
        <path d="M7 3.6V9.6M17 3.6V9.6" stroke="#facc15" strokeWidth="2.4" strokeLinecap="round" />
      )}
      <circle cx="12" cy="12" r="3" fill="#fff" stroke="#111" strokeWidth="1.5" />
    </>
  )
}

function Bottle({ body, edge }: { body: string; edge: string }) {
  return (
    <>
      <rect x="9" y="1.5" width="6" height="3" rx="1" fill="#4b5563" />
      <rect x="10.25" y="4.5" width="3.5" height="3" fill="#9ca3af" />
      <path d="M6.5 10.5a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3V19a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3Z" fill={body} stroke={edge} strokeWidth="1.2" />
      <rect x="8.5" y="12.5" width="7" height="4.5" rx="1" fill="#fff" opacity="0.85" />
    </>
  )
}

/** The evolution stones (v88): one shape, each in its own colours and with its own mark inside. */
const STONES: Record<string, { body: string; edge: string; mark: string; glyph: 'bolt' | 'drop' | 'flame' | 'leaf' | 'flake' | 'moon' | 'sun' | 'dusk' | 'star' }> = {
  thunder_stone: { body: '#86efac', edge: '#15803d', mark: '#facc15', glyph: 'bolt' },
  water_stone: { body: '#7dd3fc', edge: '#0369a1', mark: '#1d4ed8', glyph: 'drop' },
  fire_stone: { body: '#fdba74', edge: '#c2410c', mark: '#dc2626', glyph: 'flame' },
  leaf_stone: { body: '#bef264', edge: '#4d7c0f', mark: '#15803d', glyph: 'leaf' },
  ice_stone: { body: '#e0f2fe', edge: '#0284c7', mark: '#38bdf8', glyph: 'flake' },
  moon_stone: { body: '#94a3b8', edge: '#334155', mark: '#f8fafc', glyph: 'moon' },
  sun_stone: { body: '#fde047', edge: '#c2410c', mark: '#ea580c', glyph: 'sun' },
  dusk_stone: { body: '#6b21a8', edge: '#3b0764', mark: '#f472b6', glyph: 'dusk' },
  shiny_stone: { body: '#f5f5f4', edge: '#a8a29e', mark: '#facc15', glyph: 'star' },
}

function Stone({ body, edge, mark, glyph }: (typeof STONES)[string]) {
  return (
    <>
      <path d="M12 2 19.5 7.5 18 18 12 22 6 18 4.5 7.5Z" fill={body} stroke={edge} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12 2 4.5 7.5 9 9.5Z" fill="#fff" opacity="0.35" />
      <g fill={mark} stroke={mark} strokeLinecap="round" strokeLinejoin="round">
        {glyph === 'bolt' && <path d="M13 6.5 9.5 12.5h3l-1.5 5.5 4-7h-3l1-4.5Z" stroke="none" />}
        {glyph === 'drop' && <path d="M12 7c2 2.6 3 4.4 3 6a3 3 0 0 1-6 0c0-1.6 1-3.4 3-6Z" stroke="none" />}
        {glyph === 'flame' && <path d="M12 7c2.6 2.4 3.5 4.3 3.5 6.2a3.5 3.5 0 0 1-7 0c0-1.3.6-2.4 1.6-3.3.2 1 .8 1.6 1.4 1.8-.3-1.6 0-3.1.5-4.7Z" stroke="none" />}
        {glyph === 'leaf' && <path d="M8.5 16c0-5 3-8 7-8.5-.3 4.6-3 8-7 8.5Zm0 0 4-4.5" fill="none" strokeWidth="1.4" />}
        {glyph === 'flake' && <path d="M12 7.5v9M8.1 9.8l7.8 4.4M8.1 14.2l7.8-4.4" fill="none" strokeWidth="1.4" />}
        {glyph === 'moon' && <path d="M14 8a4.5 4.5 0 1 0 0 8.5A4 4 0 0 1 14 8Z" stroke="none" />}
        {glyph === 'sun' && <><circle cx="12" cy="12" r="2.6" stroke="none" /><path d="M12 7v1.3M12 15.7V17M7 12h1.3M15.7 12H17M8.5 8.5l.9.9M14.6 14.6l.9.9M8.5 15.5l.9-.9M14.6 9.4l.9-.9" fill="none" strokeWidth="1.2" /></>}
        {glyph === 'dusk' && <><circle cx="12" cy="13" r="3" stroke="none" opacity="0.9" /><path d="M8 10.5h8" fill="none" strokeWidth="1.2" /></>}
        {glyph === 'star' && <path d="M12 7.5l1.3 3 3.2.3-2.4 2.1.7 3.1L12 14.4 9.2 16l.7-3.1-2.4-2.1 3.2-.3Z" stroke="none" />}
      </g>
    </>
  )
}
