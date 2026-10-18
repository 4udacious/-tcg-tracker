// Pulls the printed cover panel out of a three-quarter product photo of a
// binder and flattens it to a straight-on rectangle, so it sits in the shelf
// next to the scanned ones instead of leaning out of the row.
//
//   node scripts/flatten-binder.mjs <photo> <out.webp> [width]
//   env: ASPECT=0.80  MASK=purple  CORNERS=edges  INSET=0.035  DEBUG=1
//
// The panel is found rather than hand-cropped: its outer ring is orange all
// the way round, so the largest connected run of warm pixels is the cover,
// and the four extreme points of that blob are its corners. The splash
// backgrounds these photos are shot on also carry orange, but those blobs are
// small and separated from the panel by the binder's white trim.
import sharp from 'sharp'

const SRC = process.argv[2]
const OUT = process.argv[3]
const WIDTH = Number(process.argv[4] ?? 420)
if (!SRC || !OUT) throw new Error('usage: flatten-binder.mjs <photo> <out.webp> [width]')

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info

// --------------------------------------------------------------- warm mask
// MASK=purple is for a binder whose whole face is purple-edged (Gym
// Challenge), shot on a wooden table: there the table is the warm thing in
// frame, and the binder is the run of purple. Purple means blue and red both
// clearly above green, which brown wood never is.
const PURPLE = process.env.MASK === 'purple'
const warm = new Uint8Array(W * H)
for (let i = 0, p = 0; p < W * H; p++, i += C) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  if (PURPLE ? b - g > 25 && r - g > 15 : r > 140 && r - b > 55 && g >= b && g <= r) warm[p] = 1
}

// ------------------------------------------------------ blobs, flood filled
const label = new Int32Array(W * H).fill(-1)
const stack = new Int32Array(W * H)
const comps = []
let next = 0

for (let start = 0; start < W * H; start++) {
  if (!warm[start] || label[start] !== -1) continue
  const id = next++
  let top = 0, size = 0, x0 = W, y0 = H, x1 = -1, y1 = -1
  stack[top++] = start
  label[start] = id
  while (top > 0) {
    const p = stack[--top]
    size++
    const x = p % W, y = (p / W) | 0
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
    if (x > 0     && warm[p - 1] && label[p - 1] === -1) { label[p - 1] = id; stack[top++] = p - 1 }
    if (x < W - 1 && warm[p + 1] && label[p + 1] === -1) { label[p + 1] = id; stack[top++] = p + 1 }
    if (y > 0     && warm[p - W] && label[p - W] === -1) { label[p - W] = id; stack[top++] = p - W }
    if (y < H - 1 && warm[p + W] && label[p + W] === -1) { label[p + W] = id; stack[top++] = p + W }
  }
  comps.push({ id, size, x0, y0, x1, y1 })
}
if (comps.length === 0) throw new Error('no cover panel found')

// The biggest blob is the cover, but artwork that crosses the panel edge to
// edge - a band of sky, a swirl - cuts the orange into separate pieces, so
// the blob is usually only the top of it. The rest of the panel is whatever
// else sits in the same column and no higher up: splash-background blobs
// either break out of that column sideways or sit entirely above the cover.
comps.sort((a, b) => b.size - a.size)
const seed = comps[0]
const PAD = 6
const keep = new Set([seed.id])
for (const c of comps) {
  if (c.id === seed.id || c.size < seed.size * 0.01) continue
  if (c.x0 >= seed.x0 - PAD && c.x1 <= seed.x1 + PAD && c.y1 > seed.y0) keep.add(c.id)
}

// --------------------------------------------------------- the four corners
// For a convex quad tilted only slightly, the extremes of x+y and x-y land on
// its corners: smallest sum is top-left, largest difference is top-right, and
// so on round the shape.
let tl, tr, bl, br
let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity
let bestSize = 0
for (let p = 0; p < W * H; p++) {
  if (label[p] < 0 || !keep.has(label[p])) continue
  bestSize++
  const x = p % W, y = (p / W) | 0
  const sum = x + y, diff = x - y
  if (sum < minSum)  { minSum = sum;   tl = [x, y] }
  if (sum > maxSum)  { maxSum = sum;   br = [x, y] }
  if (diff > maxDiff){ maxDiff = diff; tr = [x, y] }
  if (diff < minDiff){ minDiff = diff; bl = [x, y] }
}

// CORNERS=edges: for a binder with rounded corners shot nearly straight on,
// the extreme points above land somewhere on each corner's curve, and the
// quad comes out skewed. Instead fit a straight line to each of the four
// edges (the outermost mask pixel per row or column, over the middle of the
// span so the curves are left out) and intersect them.
if (process.env.CORNERS === 'edges') {
  // Every masked pixel, not just the kept blobs: artwork running into the
  // border cuts it into pieces the blob filter can drop, and edge mode is only
  // for photos whose background has none of the mask colour anyway.
  const inBlob = (p) => warm[p] === 1
  const ys = [], xs = []
  let bx0 = W, bx1 = -1, by0 = H, by1 = -1
  for (let p = 0; p < W * H; p++) if (inBlob(p)) { const x = p % W, y = (p / W) | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y) }
  for (let y = Math.round(by0 + (by1 - by0) * 0.15); y <= by0 + (by1 - by0) * 0.85; y++) ys.push(y)
  for (let x = Math.round(bx0 + (bx1 - bx0) * 0.15); x <= bx0 + (bx1 - bx0) * 0.85; x++) xs.push(x)
  // A near-straight-on edge sits within a few pixels of one value, so first
  // keep only hits near the median: where artwork runs into the border (Gym
  // Challenge's red rays on the right) the outermost purple pixel is far
  // inside, and those rows would drag the line. Then least squares, and again
  // without the worst 20%.
  const fit = (all) => {
    const med = all.map(([, v]) => v).sort((m, n) => m - n)[all.length >> 1]
    const pts = all.filter(([, v]) => Math.abs(v - med) < 20)
    const solve = (q) => { const n = q.length, sx = q.reduce((s, [t]) => s + t, 0), sy = q.reduce((s, [, v]) => s + v, 0)
      const sxx = q.reduce((s, [t]) => s + t * t, 0), sxy = q.reduce((s, [t, v]) => s + t * v, 0)
      const a = (n * sxy - sx * sy) / (n * sxx - sx * sx); return [a, (sy - a * sx) / n] }
    const [a, b] = solve(pts)
    const kept = pts.map((q) => [q, Math.abs(q[1] - (a * q[0] + b))]).sort((m, n) => m[1] - n[1]).slice(0, Math.ceil(pts.length * 0.8)).map(([q]) => q)
    return solve(kept)
  }
  const edge = (along, outer, first) => {
    const pts = []
    for (const t of along) {
      let hit = -1
      if (outer === 'x') for (let i = 0; i < W; i++) { const x = first ? i : W - 1 - i; if (inBlob(t * W + x)) { hit = x; break } }
      else for (let i = 0; i < H; i++) { const y = first ? i : H - 1 - i; if (inBlob(y * W + t)) { hit = y; break } }
      if (hit >= 0) pts.push([t, hit])
    }
    return fit(pts)
  }
  const [la, lb] = edge(ys, 'x', true), [ra, rb] = edge(ys, 'x', false)   // x = a*y + b
  const [ta, tb] = edge(xs, 'y', true), [ba, bb] = edge(xs, 'y', false)   // y = a*x + b
  // Where x = a1*y + b1 meets y = a2*x + b2.
  const meet = (a1, b1, a2, b2) => { const y = (a2 * b1 + b2) / (1 - a1 * a2); return [a1 * y + b1, y] }
  tl = meet(la, lb, ta, tb); tr = meet(ra, rb, ta, tb); br = meet(ra, rb, ba, bb); bl = meet(la, lb, ba, bb)
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const projected = ((dist(tl, tr) + dist(bl, br)) / 2) / ((dist(tl, bl) + dist(tr, br)) / 2)

// The warp straightens the panel whatever shape we ask for; the output's
// width-to-height ratio is a separate choice, and the quad cannot supply it.
// A binder photographed turned away from the lens is foreshortened across its
// width, so its measured ratio reads far narrower than the thing is. Pass the
// real one when you know it - a 9-pocket binder is about 0.80.
const ASPECT = Number(process.env.ASPECT ?? projected)
const OUT_W = WIDTH
const OUT_H = Math.round(WIDTH / ASPECT)

// ------------------------------------------------------ inverse homography
// Maps the destination rectangle back onto the photographed quad, so every
// output pixel is sampled rather than scattered.
function homography(src, dst) {
  // Solves for the 8 unknowns of the projective transform dst -> src.
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const [u, v] = dst[i], [x, y] = src[i]
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x)
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y)
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < 8; c++) {
    let piv = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]
    ;[b[c], b[piv]] = [b[piv], b[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]
      b[r] -= f * b[c]
    }
  }
  return b.map((v, i) => v / A[i][i])
}

const h = homography(
  [tl, tr, br, bl],
  [[0, 0], [OUT_W, 0], [OUT_W, OUT_H], [0, OUT_H]]
)

// INSET trims that fraction off every side of the flattened panel. A binder
// with rounded corners leaves a sliver of whatever it was shot on in each
// corner of the straight-edged quad; a few percent clears the curve.
const INSET = Number(process.env.INSET ?? 0)
const out = Buffer.alloc(OUT_W * OUT_H * 3)
for (let y = 0; y < OUT_H; y++) {
  for (let x = 0; x < OUT_W; x++) {
    const qx = OUT_W * INSET + x * (1 - 2 * INSET), qy = OUT_H * INSET + y * (1 - 2 * INSET)
    const d = h[6] * qx + h[7] * qy + 1
    const sx = (h[0] * qx + h[1] * qy + h[2]) / d
    const sy = (h[3] * qx + h[4] * qy + h[5]) / d

    // Bilinear, so the flattened panel does not come out jagged.
    const x0 = Math.floor(sx), y0 = Math.floor(sy)
    const fx = sx - x0, fy = sy - y0
    const o = (y * OUT_W + x) * 3
    for (let ch = 0; ch < 3; ch++) {
      let acc = 0
      for (const [dx, dy, wgt] of [
        [0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],       [1, 1, fx * fy],
      ]) {
        const px = Math.min(W - 1, Math.max(0, x0 + dx))
        const py = Math.min(H - 1, Math.max(0, y0 + dy))
        acc += data[(py * W + px) * C + ch] * wgt
      }
      out[o + ch] = Math.round(acc)
    }
  }
}

await sharp(out, { raw: { width: OUT_W, height: OUT_H, channels: 3 } })
  .webp({ quality: 88, effort: 5 })
  .toFile(OUT)

// DEBUG=1 draws the detected quad back onto the photo, which is the only
// honest way to check the corners landed on the cover.
if (process.env.DEBUG === '1') {
  const pts = [tl, tr, br, bl].map((p) => p.join(',')).join(' ')
  await sharp(SRC).composite([{
    input: Buffer.from(
      `<svg width="${W}" height="${H}">` +
      `<polygon points="${pts}" fill="none" stroke="#00ff00" stroke-width="3"/>` +
      [tl, tr, br, bl].map(([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#ff00ff" stroke-width="3"/>`).join('') +
      `</svg>`),
    top: 0, left: 0,
  }]).png().toFile(OUT.replace(/\.\w+$/, '-debug.png'))
}

console.log(`photo    ${W}x${H}`)
console.log(`panel    ${bestSize} px from ${keep.size} blob(s)`)
console.log(`corners  tl=${tl} tr=${tr} br=${br} bl=${bl}`)
console.log(`aspect   ${ASPECT.toFixed(3)} (quad as photographed: ${projected.toFixed(3)})`)
console.log(`flat     ${OUT_W}x${OUT_H}${INSET ? `, ${(INSET * 100).toFixed(1)}% trimmed each side` : ''} -> ${OUT}`)
