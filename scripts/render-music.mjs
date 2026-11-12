// Renders the battle game's music to files, so phones play one looping buffer
// instead of synthesising every note (see Sound in public/rpg/game.js).
//
//   npm run music:render              every song whose file is missing or stale
//   npm run music:render -- --all     every song again
//   npm run music:render -- gym red   just these
//
// Each song is rendered by the game's own engine, offline, into what the
// live engine feeds the music bus (the per-song mixer's output), so a file
// sounds and sits at the same level as the live song. A looping song is
// rendered as its intro and then two passes of its loop: the file is the
// intro and the second pass, whose start carries the reverb tails of the
// first, as it will when it wraps round to itself. A jingle is rendered with
// a few seconds of tail. Encoded with ffmpeg as AAC (.m4a, 128 kbps) into
// public/rpg/a/music/<song>.<hash>.m4a (the loop is followed by its first 0.12 s again, a guard for
// decoders that keep AAC's priming); public/rpg/music.json lists each
// file with its loop points and the song's fingerprint (musicSig), which the
// game checks before using it and tests/rpg checks is current.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openGame } from '../tests/rpg/harness.mjs'

const ROOT = new URL('../public/rpg/', import.meta.url).pathname
const DIR = path.join(ROOT, 'a/music'), MANIFEST = path.join(ROOT, 'music.json')
const RATE = 44100, KBPS = 128
const args = process.argv.slice(2), all = args.includes('--all'), only = args.filter((a) => !a.startsWith('--'))

fs.mkdirSync(DIR, { recursive: true })
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { songs: {} }
const g = await openGame()
await g.page.waitForTimeout(500)
const names = await g.page.evaluate(() => RENDERED_SONGS().map((n) => [n, musicSig(n)]))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'music-'))
let done = 0
for (const [name, sig] of names) {
  if (only.length && !only.includes(name)) continue
  const had = manifest.songs[name]
  if (!all && !only.length && had?.sig === sig && fs.existsSync(path.join(DIR, had.file)) && had.mp3 && fs.existsSync(path.join(DIR, had.mp3))) continue
  const t0 = Date.now()
  const r = await g.page.evaluate(async ([name, RATE]) => {
    const s = SONGS[name], len = (p) => p.lead.length * 60 / p.bpm / p.div
    const I = s.sections && s.intro ? len({ ...s, ...s.intro }) : 0
    const L = s.sections ? s.sections.reduce((a, x) => a + len({ ...s, ...x }), 0) : len(s)
    const T0 = 0.1, dur = s.loop ? T0 + I + 2 * L + 0.2 : T0 + I + L + 3
    const ac = new OfflineAudioContext(2, Math.ceil(dur * RATE), RATE)
    const out = ac.createGain(); out.connect(ac.destination)
    let t = T0; t += scheduleSong(ac, out, s, t); if (s.loop) scheduleSong(ac, out, s, t)
    prepareOffline(ac, dur)
    const buf = await ac.startRendering()
    const at = (sec) => Math.round(sec * RATE)
    // The file: the intro, then the second pass of the loop (or the whole jingle and its tail). After the loop, its first
    // GUARD seconds again: a decoder that keeps AAC's priming (and plays everything a little late) never reaches silence at
    // the seam, and a phone that streams the song (rounding the loop by hand, from a timer a busy battle can hold back) still
    // plays the right notes when it jumps back late.
    const p2 = at(T0 + I + L), GUARD = Math.min(at(3), at(L))
    const regions = s.loop ? [[at(T0), at(T0 + I)], [p2, p2 + at(L)], [p2, p2 + GUARD]] : [[at(T0), buf.length]]
    const n = regions.reduce((a, [x, y]) => a + (y - x), 0), ch = [buf.getChannelData(0), buf.getChannelData(1)]
    let peak = 0
    for (const [x, y] of regions) for (let i = x; i < y; i++) peak = Math.max(peak, Math.abs(ch[0][i]), Math.abs(ch[1][i]))
    // Kept under full scale in the file; the game turns it back up by `gain`.
    const scale = peak > 0.97 ? 0.97 / peak : 1
    const pcm = new Int16Array(n * 2); let k = 0
    for (const [x, y] of regions) for (let i = x; i < y; i++) { pcm[k++] = Math.round(ch[0][i] * scale * 32767); pcm[k++] = Math.round(ch[1][i] * scale * 32767) }
    const bytes = new Uint8Array(pcm.buffer); let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    const intro = s.loop ? at(T0 + I) - at(T0) : 0
    return { pcm: btoa(bin), samples: n, loop: !!s.loop, loopStart: intro / RATE, loopEnd: (intro + (s.loop ? at(L) : 0)) / RATE, gain: +(1 / scale).toFixed(4), peak }
  }, [name, RATE])
  // A WAV around the PCM, then AAC.
  const raw = Buffer.from(r.pcm, 'base64'), wav = Buffer.alloc(44 + raw.length)
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + raw.length, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22)
  wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(raw.length, 40); raw.copy(wav, 44)
  const w = path.join(tmp, `${name}.wav`), m = path.join(tmp, `${name}.m4a`)
  fs.writeFileSync(w, wav)
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', w, '-c:a', 'aac', '-b:a', `${KBPS}k`, '-ar', String(RATE), '-movflags', '+faststart', m])
  const body = fs.readFileSync(m), hash = createHash('sha1').update(body).digest('hex').slice(0, 8), file = `${name}.${hash}.m4a`
  // The same as MP3, for browsers that can't decode AAC into a buffer (Safari 27 on iPhone: EncodingError) but can MP3.
  // An MP3 starts with the encoder's delay (about 1100 samples of silence); the loop stays seamless all the same, since
  // past its end the file repeats the loop's first seconds (GUARD): both loop points shift together.
  const p3 = path.join(tmp, `${name}.mp3`)
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', w, '-c:a', 'libmp3lame', '-b:a', `${KBPS}k`, '-ar', String(RATE), p3])
  const body3 = fs.readFileSync(p3), mp3 = `${name}.${createHash('sha1').update(body3).digest('hex').slice(0, 8)}.mp3`
  for (const old of fs.readdirSync(DIR)) if (old.startsWith(`${name}.`) && old !== file && old !== mp3) fs.unlinkSync(path.join(DIR, old))
  fs.writeFileSync(path.join(DIR, file), body); fs.writeFileSync(path.join(DIR, mp3), body3)
  manifest.songs[name] = { file, mp3, sig, rate: RATE, samples: r.samples, loop: r.loop, loopStart: +r.loopStart.toFixed(6), loopEnd: +r.loopEnd.toFixed(6), gain: r.gain }
  done++
  console.log(`${name.padEnd(16)} ${(r.samples / RATE).toFixed(1).padStart(6)} s  ${String(Math.round(body.length / 1024)).padStart(5)} KB  peak ${r.peak.toFixed(2)}  ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}
// Songs that no longer exist leave the manifest (and their files go).
const keep = new Set(names.map(([n]) => n))
for (const n of Object.keys(manifest.songs)) if (!keep.has(n)) { fs.rmSync(path.join(DIR, manifest.songs[n].file), { force: true }); delete manifest.songs[n] }
manifest.songs = Object.fromEntries(Object.entries(manifest.songs).sort(([a], [b]) => a.localeCompare(b)))
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`${done} rendered; ${Object.keys(manifest.songs).length} in music.json`, g.errors.length ? g.errors : '')
await g.close(); process.exit(0)
