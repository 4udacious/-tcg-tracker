// Re-imports card art at 600x825 from pokemontcg.io.
// Run from the repo root:  Q=78 node scripts/import-card-art.mjs
// Then re-run scripts/sample-borders.mjs, since border colours are read
// off these files.
// The self-hosted files are the
// 240x330 "small" variant; pokemontcg.io also publishes 600x825 as _hires,
// which is what the enlarged view needs.
import sharp from 'sharp'
import { readdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'C:/Users/holla/claude/tcg-tracker/public/cards'
const QUALITY = Number(process.env.Q ?? 82)
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : 0
const CONCURRENCY = 6

const files = readdirSync(DIR).filter((f) => f.endsWith('.webp'))
const targets = (ONLY ? files.slice(0, ONLY) : files).map((f) => {
  const m = f.match(/^(.+)-([^-]+)\.webp$/)
  if (!m) throw new Error('unparseable filename: ' + f)
  return { file: f, set: m[1], num: m[2] }
})

async function fetchRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return Buffer.from(await r.arrayBuffer())
      if (r.status === 404) return null
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)))
  }
  return undefined // exhausted
}

let ok = 0, missing = [], failed = [], before = 0, after = 0
let cursor = 0

async function worker() {
  while (cursor < targets.length) {
    const t = targets[cursor++]
    const url = `https://images.pokemontcg.io/${t.set}/${t.num}_hires.png`
    const buf = await fetchRetry(url)
    if (buf === null) { missing.push(t.file); continue }
    if (buf === undefined) { failed.push(t.file); continue }

    const path = join(DIR, t.file)
    const prev = statSync(path).size
    const out = await sharp(buf)
      .resize(600, 825, { fit: 'fill' })
      .webp({ quality: QUALITY, effort: 5 })
      .toBuffer()

    // Never overwrite good art with something broken.
    const meta = await sharp(out).metadata()
    if (meta.width !== 600 || meta.height !== 825) { failed.push(t.file); continue }

    writeFileSync(path, out)
    before += prev; after += out.length; ok++
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`quality      ${QUALITY}`)
console.log(`rewritten    ${ok}/${targets.length}`)
console.log(`size         ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB`)
console.log(`avg per card ${Math.round(after / Math.max(ok, 1) / 1024)}KB`)
if (missing.length) console.log(`no hires     ${missing.length}: ${missing.slice(0, 10).join(', ')}`)
if (failed.length)  console.log(`FAILED       ${failed.length}: ${failed.slice(0, 10).join(', ')}`)
