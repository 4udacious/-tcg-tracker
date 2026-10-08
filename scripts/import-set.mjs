// Pulls a whole set's card art from pokemontcg.io into public/cards at the
// same 600x825 webp the rest of the collection uses.
//
//   SET=gym1 TOTAL=132 node scripts/import-set.mjs
//
// This is the first-time import; scripts/import-card-art.mjs re-fetches art
// for files that already exist. Run scripts/sample-borders.mjs afterwards,
// since border colours are read off these files.
import sharp from 'sharp'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'C:/Users/holla/claude/tcg-tracker/public/cards'
const SET = process.env.SET
const TOTAL = Number(process.env.TOTAL ?? 0)
const QUALITY = Number(process.env.Q ?? 82)
const CONCURRENCY = 6
const FORCE = process.env.FORCE === '1'

if (!SET || !TOTAL) throw new Error('SET and TOTAL are required')
mkdirSync(DIR, { recursive: true })

async function fetchRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return Buffer.from(await r.arrayBuffer())
      if (r.status === 404) return null
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)))
  }
  return undefined
}

const targets = Array.from({ length: TOTAL }, (_, i) => String(i + 1))
let ok = 0, skipped = 0, bytes = 0
const missing = [], failed = []
let cursor = 0

async function worker() {
  while (cursor < targets.length) {
    const num = targets[cursor++]
    const file = `${SET}-${num}.webp`
    const path = join(DIR, file)
    if (!FORCE && existsSync(path)) { skipped++; continue }

    const buf = await fetchRetry(`https://images.pokemontcg.io/${SET}/${num}_hires.png`)
    if (buf === null) { missing.push(num); continue }
    if (buf === undefined) { failed.push(num); continue }

    const out = await sharp(buf)
      .resize(600, 825, { fit: 'fill' })
      .webp({ quality: QUALITY, effort: 5 })
      .toBuffer()

    // Never write art that did not decode to a whole card.
    const meta = await sharp(out).metadata()
    if (meta.width !== 600 || meta.height !== 825) { failed.push(num); continue }

    writeFileSync(path, out)
    bytes += out.length
    ok++
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`set        ${SET}`)
console.log(`written    ${ok}/${targets.length}${skipped ? ` (${skipped} already there)` : ''}`)
console.log(`size       ${(bytes / 1048576).toFixed(1)}MB, avg ${Math.round(bytes / Math.max(ok, 1) / 1024)}KB`)
if (missing.length) console.log(`NOT FOUND  ${missing.length}: ${missing.join(', ')}`)
if (failed.length)  console.log(`FAILED     ${failed.length}: ${failed.join(', ')}`)
