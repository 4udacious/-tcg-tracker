// How many creases a card drew before creases were stored (v50).
//
// Until then ConditionedCard decided creases on the fly from the surface
// score and the copy's wear_seed, partway through one random stream it also
// used for whitening and scratches. v50 stores creases instead, so a card has
// to keep the crease it was already showing. This replays that stream - the
// exact draws, in the exact order - up to the crease decision.
//
// The same replay is ported to SQL in v50 (legacy_crease_count) so the
// backfill runs inside the database; this file is the reference it was
// checked against:
//
//   node scripts/legacy-creases.mjs id,surface,border_wear,wear_seed ...
//
// prints id -> 0, 1 or 2 creases.

const W = 245
const H = 342

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Number of creases the enlarged view drew for this copy. */
export function legacyCreaseCount(surface, borderWear, wearSeed) {
  const rnd = mulberry32(wearSeed || 1)
  const sw = Math.max(0, (100 - surface) / 100)

  for (let i = 0; i < 4; i++) rnd() // corner fraying
  for (let i = 0; i < 4; i++) rnd() // edge whitening

  const bw = Math.max(0, (100 - borderWear) / 100)
  if (bw > 0.02) {
    const runsPerEdge = Math.max(1, Math.round(1 + bw * 6))
    for (let side = 0; side < 4; side++) {
      const along = side < 2 ? W : H
      for (let i = 0; i < runsPerEdge; i++) {
        const u = rnd()
        const centre = u < 0.5
          ? Math.pow(u * 2, 1.8) * 0.5 * along
          : along - Math.pow((1 - u) * 2, 1.8) * 0.5 * along
        const len = along * (0.015 + rnd() * (0.025 + bw * 0.07))
        const a0 = Math.max(0, centre - len / 2)
        const a1 = Math.min(along, centre + len / 2)
        if (a1 - a0 < 2) continue
        const steps = Math.max(3, Math.round((a1 - a0) / 3.5))
        for (let s = 0; s <= steps; s++) { rnd(); rnd() }
      }
    }
  }

  const n = Math.round(sw * 15)
  rnd(); rnd() // first scratch anchor
  for (let i = 0; i < n; i++) {
    const roll = rnd()
    const kind = roll < 0.3 ? 'nick' : roll < 0.52 ? 'scrape' : roll < 0.66 ? 'gouge' : 'hair'
    if (rnd() < 0.45) { rnd(); rnd(); rnd(); rnd() } else { rnd(); rnd() }
    // nick: len, width, alpha. The others also draw a bow.
    const draws = kind === 'nick' ? 3 : 4
    for (let d = 0; d < draws; d++) rnd()
    rnd() // angle
  }

  const chance = Math.max(0, Math.min(0.8, (68 - surface) / 60))
  if (!(rnd() < chance)) return 0
  const make = () => {
    const a = Math.floor(rnd() * 4)
    const b = Math.floor(rnd() * 4)
    if (b === a) rnd()
    rnd(); rnd()            // the two edge points
    rnd(); rnd(); rnd(); rnd() // the two control points
  }
  make()
  return rnd() < 0.22 ? 2 : 1
}

if (process.argv[1] && process.argv[1].endsWith('legacy-creases.mjs')) {
  for (const arg of process.argv.slice(2)) {
    const [id, surface, border, seed] = arg.split(',').map(Number)
    console.log(`${id} ${legacyCreaseCount(surface, border, seed)}`)
  }
}
