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

  // A pack lying even slightly askew leaves backdrop in the corners of its
  // own bounding box, which trim stops at. Shaving the rows and columns that
  // are still almost entirely backdrop takes that last frame off.
  const shaved = await shaveBackdrop(trimmed)

  const out = await sharp(shaved.data)
    .resize({ width: WIDTH })
    .webp({ quality: 86, effort: 5 })
    .toBuffer()
  await sharp(out).toFile(`${OUT}/${name}`)

  const meta = await sharp(out).metadata()
  console.log(
    `${src}  ${before.width}x${before.height}` +
    ` -> trim ${trimmed.info.width}x${trimmed.info.height}` +
    ` -> shave ${shaved.info.width}x${shaved.info.height}` +
    ` -> ${name} ${meta.width}x${meta.height} ${Math.round(statSync(`${OUT}/${name}`).size / 1024)}KB`
  )
}

/**
 * Crops edges that are still mostly backdrop.
 *
 * The backdrop colour is taken from the picture's own corners rather than
 * assumed, so this works on a black studio sheet or a white page. An edge is
 * only cut while nearly all of it matches, so a wrapper that genuinely runs
 * dark along one side keeps that side.
 */
async function shaveBackdrop({ data: buf, info }) {
  // buf is still an encoded image, so let sharp decode it rather than
  // claiming it is raw.
  const { data: px, info: raw } = await sharp(buf)
    .removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = raw
  const at = (x, y) => { const i = (y * W + x) * 3; return [px[i], px[i + 1], px[i + 2]] }

  // Median of the four corners: one corner may already be on the subject.
  const corners = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)]
  const bg = [0, 1, 2].map((c) => corners.map((p) => p[c]).sort((a, b) => a - b)[1])
  const near = (p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) < 110

  const colBg = (x) => { let n = 0; for (let y = 0; y < H; y++) if (near(at(x, y))) n++; return n / H }
  const rowBg = (y) => { let n = 0; for (let x = 0; x < W; x++) if (near(at(x, y))) n++; return n / W }

  const LIMIT = 0.08 // never eat more than this fraction of a side
  let l = 0, r = 0, t = 0, b = 0
  while (l < W * LIMIT && colBg(l) > 0.85) l++
  while (r < W * LIMIT && colBg(W - 1 - r) > 0.85) r++
  while (t < H * LIMIT && rowBg(t) > 0.85) t++
  while (b < H * LIMIT && rowBg(H - 1 - b) > 0.85) b++

  if (l + r + t + b === 0) return { data: buf, info }

  const out = await sharp(buf)
    .extract({ left: l, top: t, width: W - l - r, height: H - t - b })
    .toBuffer({ resolveWithObject: true })
  return out
}
