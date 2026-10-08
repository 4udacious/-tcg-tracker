// Trims the surround off a photo of a booster wrapper and writes it into
// public/packs at the same width as the rest of them.
//
//   node scripts/import-pack-art.mjs <source> <name.webp> [<source> <name> ...]
//
// Pack art comes in as photographs on a white page rather than as flat
// assets, so the trim is the point: without it a pack sits small inside its
// own margin while the others fill their slot.
import sharp from 'sharp'
import { statSync } from 'node:fs'

const OUT = 'public/packs'
const WIDTH = 366
const args = process.argv.slice(2)
if (args.length === 0 || args.length % 2 !== 0) {
  throw new Error('usage: import-pack-art.mjs <source> <name.webp> [...]')
}

for (let i = 0; i < args.length; i += 2) {
  const [src, name] = [args[i], args[i + 1]]
  const before = await sharp(src).metadata()

  // threshold 20 clears an off-white page without eating the foil edge of
  // the wrapper. A photo with no margin throws, and is used as-is.
  let trimmed
  try {
    trimmed = await sharp(src).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true })
  } catch {
    trimmed = await sharp(src).toBuffer({ resolveWithObject: true })
  }

  const out = await sharp(trimmed.data)
    .resize({ width: WIDTH })
    .webp({ quality: 86, effort: 5 })
    .toBuffer()
  await sharp(out).toFile(`${OUT}/${name}`)

  const meta = await sharp(out).metadata()
  console.log(
    `${src}  ${before.width}x${before.height}` +
    ` -> trim ${trimmed.info.width}x${trimmed.info.height}` +
    ` -> ${name} ${meta.width}x${meta.height} ${Math.round(statSync(`${OUT}/${name}`).size / 1024)}KB`
  )
}
