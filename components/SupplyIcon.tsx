/**
 * Battle supplies are drawn rather than uploaded: there are only a handful,
 * the battle game knows them by key, and an SVG stays crisp both at the size
 * of a bundle's contents row and filling an item's tile. Anything without a
 * drawing of its own (a bundle, or an item added later) gets the bag.
 */
export default function SupplyIcon({ supplyKey, className }: { supplyKey: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {supplyKey === 'poke_ball' || supplyKey === 'great_ball' ? (
        <Ball great={supplyKey === 'great_ball'} />
      ) : supplyKey === 'potion' ? (
        <Bottle body="#a855f7" edge="#6b21a8" />
      ) : supplyKey === 'super_potion' ? (
        <Bottle body="#ec4899" edge="#9d174d" />
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

function Ball({ great }: { great: boolean }) {
  return (
    <>
      <circle cx="12" cy="12" r="10" fill="#fff" stroke="#111" strokeWidth="1.5" />
      <path d="M2 12a10 10 0 0 1 20 0Z" fill={great ? '#2563eb' : '#e3263a'} stroke="#111" strokeWidth="1.5" />
      {great && (
        <path d="M6.2 6.6 8.8 9.2M17.8 6.6 15.2 9.2" stroke="#e3263a" strokeWidth="2.2" strokeLinecap="round" />
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
