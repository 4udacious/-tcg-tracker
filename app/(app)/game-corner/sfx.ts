/*
 * The Game Corner's sounds, made on the spot with Web Audio: no sound files to fetch or cache. Browsers only let a
 * page make sound after a tap, so nothing plays until unlock() has run on one (the Game Corner calls it on every
 * tap). Off and on is remembered on this device (localStorage, 'gc-sound').
 *
 * And its music: SONGS.gameCorner, written in the battle game's music engine (public/rpg/game.js) and rendered with
 * the others (npm run music:render) to a file listed in public/rpg/music.json, played here as one looping buffer
 * through a PA: the house sound system, small speakers up in a big room. It has its own switch ('gc-music'). The
 * casino around you (ambience.ts, a recording) has a switch of its own.
 */

type Listener = (muted: boolean) => void
type Ctx = AudioContext

const VOLUME = 0.8
let ctx: Ctx | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = false
let musicOn = true
let loaded = false
const listeners = new Set<Listener>()
const musicListeners = new Set<Listener>()

function load() {
  if (loaded) return
  loaded = true
  try { muted = localStorage.getItem('gc-sound') === 'off'; musicOn = localStorage.getItem('gc-music') !== 'off' } catch { /* private mode: both on */ }
}

export function isMuted() { load(); return muted }

export function setMuted(m: boolean) {
  load()
  muted = m
  try { localStorage.setItem('gc-sound', m ? 'off' : 'on') } catch { /* not remembered */ }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.02)
  listeners.forEach((l) => l(m))
}

export function onMuted(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } }

/** Call from a tap: makes (or wakes) the audio, which browsers allow only then. */
export function unlock() {
  load()
  if (typeof window === 'undefined') return
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return
    ctx = new C()
    // A gentle limiter, so a shower of coins over a fanfare doesn't clip.
    const limit = ctx.createDynamicsCompressor()
    limit.threshold.value = -10; limit.ratio.value = 8; limit.attack.value = 0.003; limit.release.value = 0.15
    master = ctx.createGain()
    master.gain.value = muted ? 0 : VOLUME
    master.connect(limit).connect(ctx.destination)
  }
  if (ctx.state === 'suspended' && !hidden) ctx.resume().then(started, () => {})
  else started()
}

const startHooks = new Set<() => void>(), stopHooks = new Set<() => void>()
/** For the ambience: called whenever the room's sound may (re)start, and when the Game Corner goes. */
export function onStart(fn: () => void) { startHooks.add(fn); return () => { startHooks.delete(fn) } }
export function onStop(fn: () => void) { stopHooks.add(fn); return () => { stopHooks.delete(fn) } }
function started() { startMusic(); startHooks.forEach((f) => f()) }
/** The audio, if the Game Corner is on screen and sound is allowed and running. */
export function running(): Ctx | null { return wanted && ctx && ctx.state === 'running' && !hidden ? ctx : null }

let roomIn: GainNode | null = null
/**
 * The room: a big hall's echo (an impulse response made of decaying noise, darkened), shared by the PA and the
 * casino's noises, so they sit in one place. Returns its input.
 */
export function room(c: Ctx): AudioNode {
  if (roomIn) return roomIn
  const sec = 2.6, rate = c.sampleRate, len = Math.floor(sec * rate), ir = c.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const k = i / len, t = i / rate
      // Darker as it dies away: the noise smoothed more and more.
      lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.8 * k)
      d[i] = lp * Math.pow(1 - k, 2.4) * Math.min(1, t / 0.015)
    }
  }
  const conv = c.createConvolver(); conv.buffer = ir; conv.normalize = true
  const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 4500
  const out = c.createGain(); out.gain.value = 0.9
  roomIn = c.createGain()
  roomIn.connect(conv).connect(tone).connect(out).connect(c.destination)
  return roomIn
}

let paIn: GainNode | null = null
/**
 * The PA the music comes through: no lows and few highs (small speakers), a honky midrange, a touch of overdrive,
 * a few milliseconds late (it's across the room), and much of it heard off the walls.
 */
function pa(c: Ctx): AudioNode {
  if (paIn) return paIn
  paIn = c.createGain()
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380; hp.Q.value = 0.8
  const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1700; mid.Q.value = 1.1; mid.gain.value = 6
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; lp.Q.value = 0.9
  const drive = c.createWaveShaper(); drive.oversample = '2x'
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(1.8 * x) / Math.tanh(1.8) }
  drive.curve = curve
  const late = c.createDelay(0.1); late.delayTime.value = 0.03
  const dry = c.createGain(); dry.gain.value = 0.5
  const wet = c.createGain(); wet.gain.value = 0.55
  paIn.connect(hp).connect(mid).connect(lp).connect(drive)
  drive.connect(late).connect(dry).connect(c.destination)
  drive.connect(wet).connect(room(c))
  return paIn
}

let hidden = false
/** The page out of sight (another tab, the phone locked): everything pauses, and picks up again on return. */
export function setHidden(h: boolean) {
  hidden = h
  if (!ctx) return
  if (h) ctx.suspend().catch(() => {})
  else if (ctx.state === 'suspended') ctx.resume().then(started, () => {})
}

// ─────────────────────────────────────────────── music
/** How loud the music goes into the PA (which takes off the lows and highs, so it sits further back), under the casino. */
const MUSIC_VOL = 0.64
type SongFile = { file: string; mp3?: string; rate: number; samples: number; loopStart: number; loopEnd: number; gain?: number }
let wanted = false
let song: Promise<{ buf: AudioBuffer; f: SongFile } | null> | null = null
let musicSrc: AudioBufferSourceNode | null = null
let musicGain: GainNode | null = null

export function isMusicOn() { load(); return musicOn }
export function onMusic(l: Listener) { musicListeners.add(l); return () => { musicListeners.delete(l) } }
export function setMusicOn(on: boolean) {
  load()
  musicOn = on
  try { localStorage.setItem('gc-music', on ? 'on' : 'off') } catch { /* not remembered */ }
  musicListeners.forEach((l) => l(on))
  if (on) startMusic(); else stopMusic()
}

/** Whether the Game Corner is on screen: the music and the ambience play (once sound is allowed, and if on) only while it is. */
export function wantSound(w: boolean) {
  wanted = w
  if (w) started()
  else { stopMusic(); stopHooks.forEach((f) => f()) }
}

/** The rendered song, fetched and decoded once: the AAC file, or the MP3 where AAC won't decode. */
function loadSong(c: Ctx) {
  song ??= (async () => {
    const f: SongFile | undefined = await fetch('/rpg/music.json').then((r) => (r.ok ? r.json() : null)).then((j) => j?.songs?.gameCorner)
    if (!f) return null
    for (const file of [f.file, f.mp3]) {
      if (!file) continue
      try { return { buf: await c.decodeAudioData(await fetch(`/rpg/a/music/${file}`).then((r) => r.arrayBuffer())), f } } catch { /* the next format */ }
    }
    return null
  })().catch(() => null)
  return song
}

async function startMusic() {
  load()
  const c = ctx
  if (!wanted || !musicOn || musicSrc || !c || c.state !== 'running') return
  const got = await loadSong(c)
  if (!got || !wanted || !musicOn || musicSrc || c.state !== 'running') return
  const { buf, f } = got
  musicGain ??= (() => { const g = c.createGain(); g.gain.value = 0; g.connect(pa(c)); return g })()   // through the PA, not the sounds' switch
  // A decoder that keeps AAC's priming puts everything 1024 samples late, the loop points too (as in the battle game).
  const lead = buf.duration - f.samples / f.rate >= 1020 / f.rate ? 1024 / f.rate : 0
  const src = c.createBufferSource()
  src.buffer = buf; src.loop = true; src.loopStart = f.loopStart + lead; src.loopEnd = f.loopEnd + lead
  src.connect(musicGain)
  const t = c.currentTime + 0.03
  musicGain.gain.cancelScheduledValues(t); musicGain.gain.setValueAtTime(0.0001, t)
  musicGain.gain.exponentialRampToValueAtTime(MUSIC_VOL * (f.gain ?? 1), t + 1.5)   // a fade in
  src.start(t, lead)
  musicSrc = src
}

function stopMusic() {
  const c = ctx, src = musicSrc
  if (!c || !src || !musicGain) return
  musicSrc = null
  musicGain.gain.cancelScheduledValues(c.currentTime)
  musicGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.12)
  try { src.stop(c.currentTime + 0.6) } catch { /* already stopped */ }
}

/** The music dips under a fanfare for `sec`, then comes back up. */
function duck(sec: number) {
  const c = ctx
  if (!c || !musicSrc || !musicGain) return
  const g = musicGain.gain, full = g.value, t = c.currentTime
  g.cancelScheduledValues(t); g.setTargetAtTime(full * 0.3, t, 0.05); g.setTargetAtTime(Math.max(full, 0.0001), t + sec, 0.35)
}

/** The audio, if it may play now. */
function live(): Ctx | null {
  return ctx && master && ctx.state === 'running' && !muted ? ctx : null
}

function noise(c: Ctx) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function envelope(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}

type ToneOpts = { f: number; to?: number; type?: OscillatorType; at?: number; a?: number; d?: number; v?: number }
/** One note: a frequency (sliding to `to`), a quick attack, a decay. */
function tone(c: Ctx, { f, to, type = 'sine', at = 0, a = 0.005, d = 0.2, v = 0.2 }: ToneOpts) {
  const t = c.currentTime + at
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d)
  const g = c.createGain()
  envelope(g, t, a, v, d)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + a + d + 0.05)
}

type NoiseOpts = { at?: number; a?: number; d?: number; v?: number; type?: BiquadFilterType; f?: number; to?: number; q?: number }
/** A burst of filtered noise: clicks, snaps, swishes, thuds. */
function hiss(c: Ctx, { at = 0, a = 0.002, d = 0.05, v = 0.3, type = 'bandpass', f = 2000, to, q = 1 }: NoiseOpts) {
  const t = c.currentTime + at
  const s = c.createBufferSource()
  s.buffer = noise(c)
  const fl = c.createBiquadFilter()
  fl.type = type
  fl.frequency.setValueAtTime(f, t)
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + a + d)
  fl.Q.value = q
  const g = c.createGain()
  envelope(g, t, a, v, d)
  s.connect(fl).connect(g).connect(master!)
  s.start(t, Math.random() * 0.5)
  s.stop(t + a + d + 0.05)
}

const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 }

/** A bright chip-tune run of notes, [frequency, when] pairs. */
function run(c: Ctx, notes: [number, number][], d = 0.12, v = 0.06, at = 0) {
  for (const [f, t] of notes) {
    tone(c, { f, type: 'square', at: at + t, d, v })
    tone(c, { f: f / 2, type: 'triangle', at: at + t, d: d * 1.4, v: v * 1.3 })
  }
}

function coin(c: Ctx, at = 0, v = 0.1) {
  const f = 2200 + Math.random() * 900
  tone(c, { f, at, d: 0.28, v })
  tone(c, { f: f * 2.76, at, d: 0.12, v: v * 0.4 })
  hiss(c, { at, d: 0.015, v: v * 0.8, f: 6000, q: 2 })
}

export const sfx = {
  /** A button. */
  click() { const c = live(); if (!c) return; hiss(c, { d: 0.025, v: 0.18, f: 3200, q: 2 }); tone(c, { f: 1800, type: 'square', d: 0.015, v: 0.03 }) },

  /** A chip set down on the felt. */
  chip() {
    const c = live(); if (!c) return
    hiss(c, { d: 0.035, v: 0.35, f: 3600, q: 5 })
    hiss(c, { at: 0.045, d: 0.03, v: 0.18, f: 4400, q: 5 })
    tone(c, { f: 2700, d: 0.05, v: 0.04 })
  },

  /** Coins falling into the tray: n of them. */
  coins(n: number) { const c = live(); if (!c) return; for (let i = 0; i < Math.min(n, 30); i++) coin(c, i * 0.065 + Math.random() * 0.03, 0.09) },

  /** The slot machine's lever: a ratchet, then a clunk. */
  lever() {
    const c = live(); if (!c) return
    for (let i = 0; i < 6; i++) hiss(c, { at: i * 0.028, d: 0.012, v: 0.22, f: 1400 + i * 120, q: 6 })
    tone(c, { f: 120, to: 55, at: 0.18, d: 0.16, v: 0.35 })
    hiss(c, { at: 0.18, d: 0.09, v: 0.25, type: 'lowpass', f: 700 })
  },

  /** The reels whirring until the returned stop() is called. */
  reels(): () => void {
    const c = live(); if (!c) return () => {}
    // A loop of ticks (the reels' detent) over a low motor hum.
    const sec = 0.36, buf = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate), d = buf.getChannelData(0)
    for (let k = 0; k < 8; k++) {
      const start = Math.floor((k / 8) * d.length)
      for (let i = 0; i < 260 && start + i < d.length; i++) d[start + i] += (Math.random() * 2 - 1) * Math.exp(-i / 40) * 0.6
    }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 58
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220
    const g = c.createGain(), t = c.currentTime
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.08)
    const hg = c.createGain(); hg.gain.value = 0.06
    src.connect(bp).connect(g).connect(master!)
    hum.connect(lp).connect(hg).connect(g)
    src.start(); hum.start()
    let stopped = false
    return () => {
      if (stopped) return
      stopped = true
      const e = c.currentTime
      g.gain.setTargetAtTime(0.0001, e, 0.05)
      src.stop(e + 0.3); hum.stop(e + 0.3)
    }
  },

  /** A reel thunking to a stop (the nth, a little lower each time). */
  reelStop(n: number) {
    const c = live(); if (!c) return
    tone(c, { f: 150 - n * 12, to: 70, d: 0.12, v: 0.4 })
    hiss(c, { d: 0.05, v: 0.3, type: 'lowpass', f: 1100 })
    hiss(c, { d: 0.02, v: 0.15, f: 3000, q: 3 })
  },

  /** A rising whine while the last reel might land a big one. */
  tension(sec: number) {
    const c = live(); if (!c) return
    tone(c, { f: 400, to: 1300, type: 'sawtooth', a: sec * 0.9, d: 0.1, v: 0.035 })
    tone(c, { f: 404, to: 1310, type: 'square', a: sec * 0.9, d: 0.1, v: 0.025 })
  },

  /** A win, by how big: a bet back, a nice win, a big one, the jackpot. */
  win(size: 'back' | 'small' | 'big' | 'jackpot') {
    const c = live(); if (!c) return
    if (size === 'big' || size === 'jackpot') duck(size === 'jackpot' ? 3.2 : 1.8)
    if (size === 'back') { run(c, [[N.E6, 0], [N.G6, 0.07]], 0.1, 0.045); return }
    if (size === 'small') { run(c, [[N.C6, 0], [N.E6, 0.07], [N.G6, 0.14], [N.C7, 0.21]], 0.12, 0.05); return }
    const fan: [number, number][] = [[N.C5, 0], [N.E5, 0.1], [N.G5, 0.2], [N.C6, 0.3], [N.G5, 0.42], [N.C6, 0.5]]
    run(c, fan, 0.14, 0.06)
    for (const f of [N.C6, N.E6, N.G6]) { tone(c, { f, type: 'square', at: 0.64, a: 0.01, d: 0.7, v: 0.04 }); tone(c, { f: f / 2, type: 'triangle', at: 0.64, d: 0.9, v: 0.06 }) }
    if (size === 'jackpot') {
      run(c, [[N.C6, 1.4], [N.D6, 1.5], [N.E6, 1.6], [N.G6, 1.7], [N.A6, 1.8], [N.C7, 1.9]], 0.12, 0.05)
      for (let i = 0; i < 4; i++) tone(c, { f: N.C7 * (i % 2 ? 1.5 : 1), at: 2.1 + i * 0.18, d: 0.6, v: 0.05 })
    }
  },

  /** A soft "not this time". */
  lose() { const c = live(); if (!c) return; tone(c, { f: 392, type: 'triangle', d: 0.16, v: 0.07 }); tone(c, { f: 294, type: 'triangle', at: 0.15, d: 0.3, v: 0.07 }) },

  /** The croupier's bell: no more bets. */
  bell() {
    const c = live(); if (!c) return
    for (const [r, v] of [[1, 0.12], [2.4, 0.05], [3.9, 0.03], [5.4, 0.015]] as const) tone(c, { f: 1480 * r, d: 1.3 / r, v })
  },

  /**
   * The roulette wheel: the ball rolling round the track for `sec`, dropping at `dropAt` and rattling across the
   * frets into its pocket.
   */
  wheel(sec: number, dropAt: number) {
    const c = live(); if (!c) return
    const t = c.currentTime
    const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3
    bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(700, t + dropAt)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.15); g.gain.exponentialRampToValueAtTime(0.04, t + dropAt)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dropAt + 0.2)
    // The ball's wobble on the track.
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.setValueAtTime(14, t); lfo.frequency.linearRampToValueAtTime(5, t + dropAt); lg.gain.value = 0.05
    lfo.connect(lg).connect(g.gain)
    s.connect(bp).connect(g).connect(master!)
    s.start(t); lfo.start(t); s.stop(t + dropAt + 0.3); lfo.stop(t + dropAt + 0.3)
    // Bouncing over the frets, each hop shorter, then the pocket.
    let at = dropAt
    for (let i = 0; i < 7; i++) {
      hiss(c, { at, d: 0.025, v: 0.3 - i * 0.03, f: 2200 + Math.random() * 1200, q: 4 })
      tone(c, { f: 900 + Math.random() * 300, at, d: 0.04, v: 0.05 })
      at += 0.2 * Math.pow(0.78, i)
    }
    hiss(c, { at: Math.min(sec, at + 0.05), d: 0.06, v: 0.2, type: 'lowpass', f: 900 })
  },

  /** A card snapped off the shoe onto the felt. */
  deal(at = 0) {
    const c = live(); if (!c) return
    hiss(c, { at, a: 0.004, d: 0.07, v: 0.25, type: 'highpass', f: 5000, to: 1800 })
    hiss(c, { at: at + 0.06, d: 0.02, v: 0.12, f: 1500, q: 2 })
  },

  /** A card turned over. */
  flip(at = 0) { const c = live(); if (!c) return; hiss(c, { at, d: 0.035, v: 0.18, f: 2000, q: 1.5 }); hiss(c, { at: at + 0.055, d: 0.03, v: 0.14, f: 2600, q: 1.5 }) },

  /** Your turn. */
  turn() { const c = live(); if (!c) return; tone(c, { f: N.A5, d: 0.18, v: 0.1 }); tone(c, { f: N.E6, at: 0.1, d: 0.3, v: 0.1 }) },

  /** A tick as a timer runs out. */
  tick() { const c = live(); if (!c) return; tone(c, { f: 1600, type: 'square', d: 0.02, v: 0.03 }) },

  /** A bust: a thud and a sag. */
  bust() { const c = live(); if (!c) return; tone(c, { f: 196, to: 82, type: 'triangle', d: 0.4, v: 0.14 }); hiss(c, { d: 0.18, v: 0.2, type: 'lowpass', f: 400 }) },

  /** A push: your bet back. */
  push() { const c = live(); if (!c) return; tone(c, { f: N.G5, type: 'triangle', d: 0.12, v: 0.08 }); tone(c, { f: N.G5, type: 'triangle', at: 0.13, d: 0.2, v: 0.08 }) },

  /** Someone else's big win, along the row. */
  distantWin() { const c = live(); if (!c) return; run(c, [[N.C6, 0], [N.E6, 0.08], [N.G6, 0.16]], 0.1, 0.015) },
}
