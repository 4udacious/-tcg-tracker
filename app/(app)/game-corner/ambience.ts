/*
 * The casino around you: a recording of a busy casino floor (slot machines, coins, chatter), looping behind your own
 * game's sounds while the Game Corner is on screen. A switch of its own ('gc-ambience').
 *
 * The file is the recording made to loop without a seam (its last 4 s faded into its first 4 s), then the loop's first
 * 2 s again after its end, a guard for decoders that shift everything a little late (as the battle game's rendered
 * music has). public/sounds/casino-floor.<hash>.m4a, and the same as MP3 where AAC won't decode.
 */
import { onStart, onStop, running } from './sfx'

type Ctx = AudioContext
type Listener = (on: boolean) => void

/** The recording: AAC, MP3, and the loop's length (the guard after it isn't part of the loop). */
const FLOOR = { m4a: '/sounds/casino-floor.735c7b52.m4a', mp3: '/sounds/casino-floor.95f94369.mp3', frames: 4305571, rate: 44100 }
/** How loud the floor is. */
const LEVEL = 0.6

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

let gain: GainNode | null = null
let trim: GainNode | null = null
let level = 1

/** The house level for the casino floor (Admin -> VVM -> Game Corner): 1 as set here, 0 silent, 2 twice as loud. */
export function setAmbienceLevel(x: number) {
  level = Math.max(0, Math.min(2, x))
  if (trim) trim.gain.setTargetAtTime(level, trim.context.currentTime, 0.1)
}
let src: AudioBufferSourceNode | null = null
let buf: Promise<AudioBuffer | null> | null = null
let starting = false

/** The recording, fetched and decoded once: AAC, or MP3 where AAC won't decode. */
function floor(c: Ctx) {
  buf ??= (async () => {
    for (const url of [FLOOR.m4a, FLOOR.mp3]) {
      try { return await c.decodeAudioData(await fetch(url).then((r) => r.arrayBuffer())) } catch { /* the next format */ }
    }
    return null
  })()
  return buf
}

async function start() {
  load()
  const c = running()
  if (!c || !on || src || starting) return
  starting = true
  const b = await floor(c).catch(() => null)
  starting = false
  if (!b || src || !on || !running()) return
  trim ??= (() => { const g = c.createGain(); g.gain.value = level; g.connect(c.destination); return g })()
  gain ??= (() => { const g = c.createGain(); g.gain.value = 0.0001; g.connect(trim!); return g })()
  // A decoder that keeps AAC's priming puts everything 1024 samples late: the loop points move with it.
  const loop = FLOOR.frames / FLOOR.rate, lead = b.duration - (FLOOR.frames + 2 * FLOOR.rate) / FLOOR.rate >= 1020 / FLOOR.rate ? 1024 / FLOOR.rate : 0
  const s = c.createBufferSource()
  s.buffer = b; s.loop = true; s.loopStart = lead; s.loopEnd = lead + loop
  s.connect(gain)
  const t = c.currentTime + 0.05
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(LEVEL, t + 2)   // a fade in
  s.start(t, lead + Math.random() * loop)   // somewhere in the recording, so it isn't always the same moment you walk in on
  src = s
}

function stop() {
  if (!gain || !src) return
  const c = gain.context as Ctx, s = src
  src = null
  gain.gain.cancelScheduledValues(c.currentTime); gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.25)
  try { s.stop(c.currentTime + 1.5) } catch { /* already */ }
}

onStart(start)
onStop(stop)
