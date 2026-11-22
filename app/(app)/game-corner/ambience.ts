/*
 * The casino around you: a crowd talking, and the floor's noises at a distance, at random (slot machines paying
 * out, reels spinning, coins, chips, a shuffle, a roulette ball, a laugh, a cheer, now and then a jackpot bell). All
 * of it behind your own game's sounds, through the room's echo (sfx.ts), while the Game Corner is on screen. A
 * switch of its own ('gc-ambience').
 *
 * The crowd is a murmur made here (a few seconds' work for the browser, once): voices babbling vowels, too far off
 * to make out. A recording sounds better: put a seamless loop of casino crowd noise (no music in it, no words you
 * can make out, licensed to use) in public/game-corner/ and name it in CROWD_RECORDING.
 */
import { onStart, onStop, room, running } from './sfx'

type Ctx = AudioContext
type Listener = (on: boolean) => void

/** A recorded crowd loop to use instead of the made one, e.g. '/game-corner/crowd.m4a'. */
const CROWD_RECORDING: string | null = null
/** How loud the casino is, all together. */
const LEVEL = 0.5

let on = true
let loaded = false
const listeners = new Set<Listener>()
function load() {
  if (loaded) return
  loaded = true
  try { on = localStorage.getItem('gc-ambience') !== 'off' } catch { /* private mode: on */ }
}
export function isAmbienceOn() { load(); return on }
export function onAmbience(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } }
export function setAmbienceOn(v: boolean) {
  load()
  on = v
  try { localStorage.setItem('gc-ambience', v ? 'on' : 'off') } catch { /* not remembered */ }
  listeners.forEach((l) => l(v))
  if (v) start(); else stop()
}

let bus: GainNode | null = null
let crowd: AudioBufferSourceNode | null = null
let crowdBuf: Promise<AudioBuffer | null> | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let starting = false

/** Everything ambient goes in here: some straight to you, more of it off the walls. */
function busFor(c: Ctx) {
  if (bus) return bus
  bus = c.createGain(); bus.gain.value = 0.0001
  const dry = c.createGain(); dry.gain.value = 0.6
  const wet = c.createGain(); wet.gain.value = 0.7
  bus.connect(dry).connect(c.destination)
  bus.connect(wet).connect(room(c))
  return bus
}

async function start() {
  load()
  const c = running()
  if (!c || !on || starting) return
  const b = busFor(c)
  b.gain.cancelScheduledValues(c.currentTime); b.gain.setTargetAtTime(LEVEL, c.currentTime, 0.8)
  if (!timer) next()
  if (crowd) return
  starting = true
  const buf = await crowdBuffer(c).catch(() => null)
  starting = false
  if (!buf || crowd || !on || !running()) return
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true
  src.connect(b); src.start(c.currentTime + 0.05, Math.random() * buf.duration)
  crowd = src
}

function stop() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!bus) return
  const c = bus.context as Ctx
  bus.gain.cancelScheduledValues(c.currentTime); bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.25)
  if (crowd) { try { crowd.stop(c.currentTime + 1.5) } catch { /* already */ } crowd = null }
}

onStart(start)
onStop(stop)

// ─────────────────────────────────────────────── the crowd
function crowdBuffer(c: Ctx) {
  crowdBuf ??= (async () => {
    if (CROWD_RECORDING) {
      try { return await c.decodeAudioData(await fetch(CROWD_RECORDING).then((r) => r.arrayBuffer())) } catch { /* make one instead */ }
    }
    return makeCrowd(c)
  })()
  return crowdBuf
}

/** Mouth shapes: the first two resonances of a few vowels (Hz). */
const VOWELS: [number, number][] = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [440, 1020], [300, 870], [660, 1720], [490, 1350], [400, 1900]]

/**
 * A room full of people talking, too far off to make out: ten voices (a buzz for the voice, a little breath, through
 * two moving resonances for the mouth) babbling in phrases, each its own pitch, place and distance. Rendered once
 * (24 s, its end faded into its start so it loops without a seam) and played on a loop.
 */
async function makeCrowd(c: Ctx): Promise<AudioBuffer> {
  const rate = 22050, sec = 24, fade = 2, total = sec + fade
  const oc = new OfflineAudioContext(2, Math.ceil(total * rate), rate)
  const far = oc.createBiquadFilter(); far.type = 'lowpass'; far.frequency.value = 1600
  const thin = oc.createBiquadFilter(); thin.type = 'highpass'; thin.frequency.value = 140
  far.connect(thin).connect(oc.destination)
  const air = oc.createBuffer(1, rate * 2, rate), ad = air.getChannelData(0)
  for (let i = 0; i < ad.length; i++) ad[i] = Math.random() * 2 - 1
  const r = Math.random
  for (let k = 0; k < 10; k++) {
    const high = r() < 0.45, f0 = high ? 170 + r() * 70 : 92 + r() * 48, scale = high ? 1.16 : 1
    const osc = oc.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f0
    const breath = oc.createBufferSource(); breath.buffer = air; breath.loop = true
    const bg = oc.createGain(); bg.gain.value = 0.3
    const src = oc.createGain()
    osc.connect(src); breath.connect(bg).connect(src)
    const f1 = oc.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6
    const f2 = oc.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8
    const g2 = oc.createGain(); g2.gain.value = 0.7
    const env = oc.createGain(); env.gain.value = 0
    const pan = oc.createStereoPanner(); pan.pan.value = r() * 1.8 - 0.9
    const dist = oc.createGain(); dist.gain.value = 0.18 + r() * 0.42
    src.connect(f1).connect(env); src.connect(f2).connect(g2).connect(env)
    env.connect(pan).connect(dist).connect(far)
    let t = r() * 2.5
    while (t < total) {
      // A phrase: a run of syllables, wandering in pitch and falling at its end, then a pause.
      const n = 4 + Math.floor(r() * 11)
      let pitch = f0 * (0.95 + r() * 0.15)
      for (let i = 0; i < n && t < total; i++) {
        const d = 0.08 + r() * 0.17, [a, b] = VOWELS[Math.floor(r() * VOWELS.length)]
        f1.frequency.setTargetAtTime(a * scale, t, 0.02); f2.frequency.setTargetAtTime(b * scale, t, 0.025)
        pitch *= 0.97 + r() * 0.06
        osc.frequency.setTargetAtTime(pitch, t, 0.04)
        env.gain.setTargetAtTime(0.45 + r() * 0.55, t, 0.012)
        env.gain.setTargetAtTime(0.0001, t + d * 0.7, 0.025)
        t += d + r() * 0.05
      }
      osc.frequency.setTargetAtTime(f0 * 0.85, Math.max(0, t - 0.12), 0.1)
      t += 0.3 + r() * 1.7
    }
    osc.start(0); breath.start(0)
  }
  const buf = await oc.startRendering()
  const L = Math.floor(sec * rate), F = Math.floor(fade * rate), loop = c.createBuffer(2, L, rate)
  let peak = 0
  for (let ch = 0; ch < 2; ch++) {
    const s = buf.getChannelData(ch), d = loop.getChannelData(ch)
    for (let i = 0; i < L; i++) d[i] = s[i]
    for (let i = 0; i < F; i++) { const k = i / F; d[i] = s[i] * k + s[L + i] * (1 - k) }   // the tail fades into the head
    for (let i = 0; i < L; i++) peak = Math.max(peak, Math.abs(d[i]))
  }
  const norm = peak > 0 ? 0.5 / peak : 1
  for (let ch = 0; ch < 2; ch++) { const d = loop.getChannelData(ch); for (let i = 0; i < L; i++) d[i] *= norm }
  return loop
}

// ─────────────────────────────────────────────── the floor's noises
/** The next noise from somewhere on the floor, a second or five from now. */
function next() {
  timer = setTimeout(() => {
    timer = null
    if (!on) return
    const c = running()
    if (c && bus) somewhere(c, bus)
    if (on && running()) next()
  }, 1200 + Math.random() * 3800)
}

/** Somewhere across the room: off to one side, dulled by the distance. */
function spot(c: Ctx, b: GainNode, near = 0.5): AudioNode {
  const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 1.8 - 0.9
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + near * 2200
  const g = c.createGain(); g.gain.value = 0.35 + near * 0.65
  pan.connect(lp).connect(g).connect(b)
  return pan
}

function env(g: GainNode, t: number, peak: number, a: number, d: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}
function beep(c: Ctx, out: AudioNode, t: number, f: number, d: number, v: number, type: OscillatorType = 'square') {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f
  env(g, t, v, 0.004, d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05)
}
let noiseBuf: AudioBuffer | null = null
function burst(c: Ctx, out: AudioNode, t: number, f: number, q: number, d: number, v: number) {
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const x = noiseBuf.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1 }
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain()
  s.buffer = noiseBuf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q
  env(g, t, v, 0.002, d); s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05)
}
/** A voice: syllables on one pitch line, through vowel shapes (a laugh, a whoop). */
function say(c: Ctx, out: AudioNode, t: number, f0: number, syl: [number, number, number][], v: number) {
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0
  const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), g2 = c.createGain()
  f1.type = f2.type = 'bandpass'; f1.Q.value = 7; f2.Q.value = 9; g2.gain.value = 0.6; g.gain.value = 0
  o.connect(f1).connect(g); o.connect(f2).connect(g2).connect(g); g.connect(out)
  let at = t
  for (const [d, pitch, vowel] of syl) {
    const [a, b] = VOWELS[vowel]
    f1.frequency.setValueAtTime(a, at); f2.frequency.setValueAtTime(b, at); o.frequency.setTargetAtTime(f0 * pitch, at, 0.03)
    g.gain.setTargetAtTime(v, at, 0.01); g.gain.setTargetAtTime(0.0001, at + d * 0.65, 0.02)
    at += d
  }
  o.start(t); o.stop(at + 0.3)
}

const N = (semi: number, base = 880) => base * Math.pow(2, semi / 12)
const JINGLES = [[0, 4, 7, 12], [0, 4, 7, 12, 16, 19, 24], [12, 7, 4, 0, 4, 7, 12], [0, 7, 12, 7, 0, 7, 12], [0, 2, 4, 7, 9, 12], [7, 12, 7, 12, 16]]

/** One noise, picked by how often you'd hear it. */
function somewhere(c: Ctx, b: GainNode) {
  const t = c.currentTime + 0.05, r = Math.random(), roll = Math.random()
  if (roll < 0.34) {
    // A slot machine paying out: its jingle, maybe twice, then coins.
    const out = spot(c, b, r * 0.6), j = JINGLES[Math.floor(Math.random() * JINGLES.length)], base = [784, 880, 988, 1047][Math.floor(Math.random() * 4)]
    const reps = Math.random() < 0.35 ? 2 : 1, step = 0.075 + Math.random() * 0.03
    for (let k = 0; k < reps; k++) j.forEach((s, i) => beep(c, out, t + (k * j.length + i) * step, N(s, base), step * 0.9, 0.06))
    if (Math.random() < 0.6) coins(c, out, t + reps * j.length * step + 0.05, 3 + Math.floor(Math.random() * 6))
  } else if (roll < 0.48) {
    // Someone spinning: the reels ticking, and three thunks.
    const out = spot(c, b, r * 0.5)
    for (let i = 0; i < 18; i++) burst(c, out, t + i * 0.05, 2400, 3, 0.012, 0.12)
    for (let k = 0; k < 3; k++) beep(c, out, t + 0.95 + k * 0.22, 130 - k * 10, 0.1, 0.25, 'sine')
  } else if (roll < 0.62) {
    coins(c, spot(c, b, r * 0.7), t, 4 + Math.floor(Math.random() * 7))
  } else if (roll < 0.74) {
    // Chips: a stack set down, a couple more.
    const out = spot(c, b, r * 0.8), n = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < n; i++) { const at = t + i * (0.06 + Math.random() * 0.1); burst(c, out, at, 3400, 5, 0.03, 0.4); burst(c, out, at + 0.04, 4300, 5, 0.02, 0.2) }
  } else if (roll < 0.81) {
    // A dealer shuffling: the riffle, then the bridge.
    const out = spot(c, b, r * 0.6)
    for (let i = 0; i < 32; i++) burst(c, out, t + i * 0.017 + Math.random() * 0.004, 2600 + Math.random() * 1500, 2, 0.01, 0.16)
    burst(c, out, t + 0.62, 1800, 0.8, 0.25, 0.12)
  } else if (roll < 0.86) {
    // A roulette ball at another table, rolling and dropping.
    const out = spot(c, b, r * 0.4)
    for (let i = 0; i < 20; i++) burst(c, out, t + i * 0.08, 1600 - i * 30, 2, 0.06, 0.05)
    let at = t + 1.7
    for (let i = 0; i < 6; i++) { burst(c, out, at, 2600, 4, 0.02, 0.3 - i * 0.04); at += 0.18 * Math.pow(0.78, i) }
  } else if (roll < 0.93) {
    // A laugh: ha-ha-ha.
    const f0 = Math.random() < 0.5 ? 220 + Math.random() * 60 : 130 + Math.random() * 30
    say(c, spot(c, b, r * 0.5), t, f0, Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => [0.13, 1.15 - i * 0.05, 0] as [number, number, number]), 0.35)
  } else if (roll < 0.97) {
    // A table cheering a win: a few whoops and some clapping.
    const out = spot(c, b, r * 0.5)
    for (let k = 0; k < 4; k++) {
      const f0 = (Math.random() < 0.5 ? 210 : 140) * (0.9 + Math.random() * 0.2)
      say(c, out, t + Math.random() * 0.3, f0, [[0.18, 1, 5], [0.45, 1.35, 0], [0.2, 1.1, 0]], 0.22)
    }
    for (let i = 0; i < 16; i++) burst(c, out, t + 0.3 + Math.random() * 1.6, 1500 + Math.random() * 800, 1.2, 0.03, 0.25)
  } else {
    // Far off, a jackpot bell ringing.
    const out = spot(c, b, 0.15)
    for (let i = 0; i < 22; i++) { const at = t + i * 0.07; beep(c, out, at, 1320, 0.09, 0.08, 'sine'); beep(c, out, at, 1320 * 2.76, 0.05, 0.03, 'sine') }
  }
}

function coins(c: Ctx, out: AudioNode, t: number, n: number) {
  for (let i = 0; i < n; i++) {
    const at = t + i * 0.07 + Math.random() * 0.03, f = 2200 + Math.random() * 900
    beep(c, out, at, f, 0.22, 0.05, 'sine'); beep(c, out, at, f * 2.76, 0.1, 0.02, 'sine')
  }
}
