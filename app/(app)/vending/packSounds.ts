'use client'

import { useSyncExternalStore } from 'react'
import { getSettings, onSettingsChange } from '@/lib/settings'

/**
 * Sound for opening packs, synthesised on the spot with Web Audio: no files
 * to fetch, and every rip comes out a little different.
 *
 *   rip     foil tearing, then the pack giving way
 *   deal    a card sliding into view
 *   flip    the last card turning over
 *   rise    a slab coming up out of its mystery pack
 *   chime   a plain last card, turned
 *   holo    a holo landing
 *   secret  a secret rare landing
 *   stamp   a grade hitting the label
 *   crack   a slab corner prised open
 *   slip    the tool skidding off a corner
 *
 * Browsers only allow audio after a tap, so the first sound of a sequence
 * must be played from inside a click or key handler; later ones can come
 * from effects once the context is running. Muting is per browser and
 * remembered.
 */

export type PackSound =
  | 'rip' | 'deal' | 'flip' | 'rise' | 'chime' | 'holo' | 'secret' | 'stamp' | 'crack' | 'slip'

// ─────────────────────────────────────────────────────────────── muting
const KEY = 'vm-sound'
const listeners = new Set<() => void>()
let muted = (() => {
  try { return localStorage.getItem(KEY) === 'off' } catch { return false }
})()

export function setPackSoundsMuted(next: boolean) {
  muted = next
  try { localStorage.setItem(KEY, next ? 'off' : 'on') } catch {}
  listeners.forEach((f) => f())
  // Turning sound on is itself a tap, which is the chance to wake the context.
  if (!next) context()
}

export function usePackSoundsMuted(): boolean {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f) } },
    () => muted,
    () => false,
  )
}

// ─────────────────────────────────────────────────────────────── engine
let ctx: AudioContext | null = null
let out: GainNode | null = null
// A feedback delay that sparkles get sent into, so chimes ring on.
let shimmer: GainNode | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()

    // Everything through one gentle compressor, so a secret rare stacked on
    // a deal never clips.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -12
    comp.ratio.value = 4
    out = ctx.createGain()
    // Scaled by Settings → Effects volume, and kept in step if it changes.
    out.gain.value = 0.7 * getSettings().effectsVolume
    onSettingsChange(() => { if (out) out.gain.value = 0.7 * getSettings().effectsVolume })
    out.connect(comp).connect(ctx.destination)

    shimmer = ctx.createGain()
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.13
    const feedback = ctx.createGain()
    feedback.gain.value = 0.4
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 5200
    const wet = ctx.createGain()
    wet.gain.value = 0.45
    shimmer.connect(delay)
    delay.connect(damp).connect(feedback).connect(delay)
    damp.connect(wet).connect(out)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** Plain white noise, made fresh so no two rips share a grain. */
function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(seconds * ac.sampleRate))
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/**
 * Tearing foil: noise chopped into crackles that come faster and harder as
 * the tear runs, then let go.
 */
function ripBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const sr = ac.sampleRate
  const n = Math.floor(seconds * sr)
  const buf = ac.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  let i = 0
  while (i < n) {
    const t = i / n
    const env = t < 0.08 ? t / 0.08 : Math.pow(1 - (t - 0.08) / 0.92, 0.55)
    const len = Math.floor(sr * (0.002 + Math.random() * 0.009))
    const gap = Math.floor(sr * (0.001 + Math.random() * 0.006 * (1 - 0.75 * t)))
    const amp = (0.35 + Math.random() * 0.65) * env
    for (let k = 0; k < len && i < n; k++, i++) d[i] = (Math.random() * 2 - 1) * amp * (1 - k / len)
    for (let k = 0; k < gap && i < n; k++, i++) d[i] = (Math.random() * 2 - 1) * amp * 0.07
  }
  return buf
}

/** An envelope on a fresh gain: quick attack, exponential tail. */
function envelope(ac: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  return g
}

/** Filtered noise with a frequency sweep through the given points. */
function sweep(
  ac: AudioContext, at: number, dur: number, peak: number,
  points: [number, number][], q = 1, type: BiquadFilterType = 'bandpass', attack = 0.01,
) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, dur + 0.05)
  const f = ac.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(points[0][1], at)
  for (const [time, hz] of points.slice(1)) f.frequency.exponentialRampToValueAtTime(hz, at + time)
  const g = envelope(ac, at, peak, attack, Math.max(0.02, dur - attack))
  src.connect(f).connect(g).connect(out!)
  src.start(at)
  src.stop(at + dur + 0.05)
}

/** A short bright click, for a card edge snapping flat. */
function tick(ac: AudioContext, at: number, peak: number) {
  sweep(ac, at, 0.03, peak, [[0, 4200]], 0.8, 'highpass', 0.002)
}

/** A falling sine: the low end of a thump. */
function thump(ac: AudioContext, at: number, peak: number, from: number, to: number, dur: number) {
  const o = ac.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(from, at)
  o.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = envelope(ac, at, peak, 0.006, dur)
  o.connect(g).connect(out!)
  o.start(at)
  o.stop(at + dur + 0.05)
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** A small bell: a sine with a quieter, slightly sharp partial an octave up. */
function bell(ac: AudioContext, at: number, midi: number, peak: number, decay: number, wet = 0.6) {
  const g = envelope(ac, at, peak, 0.004, decay)
  g.connect(out!)
  if (shimmer) {
    const send = ac.createGain()
    send.gain.value = wet
    g.connect(send).connect(shimmer)
  }
  const partials: [OscillatorType, number, number][] = [
    ['sine', 1, 1], ['triangle', 2.003, 0.35], ['sine', 3.01, 0.12],
  ]
  for (const [type, mult, level] of partials) {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = hz(midi) * mult
    const l = ac.createGain()
    l.gain.value = level
    o.connect(l).connect(g)
    o.start(at)
    o.stop(at + decay + 0.1)
  }
}

// ─────────────────────────────────────────────────────────────── sounds
const SOUNDS: Record<PackSound, (ac: AudioContext, at: number, step: number) => void> = {
  rip(ac, at) {
    const dur = 0.46
    const src = ac.createBufferSource()
    src.buffer = ripBuffer(ac, dur)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 750
    // Brighter as the tear runs out to the corner.
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, at)
    lp.frequency.exponentialRampToValueAtTime(9500, at + dur)
    const g = ac.createGain()
    g.gain.value = 0.95
    src.connect(hp).connect(lp).connect(g).connect(out!)
    src.start(at)
    // The wrapper giving way at the end of the tear.
    thump(ac, at + dur - 0.06, 0.45, 170, 55, 0.14)
    sweep(ac, at + dur - 0.07, 0.18, 0.25, [[0, 900], [0.18, 2400]], 0.7)
  },

  // `step` runs 0..1 through the pack, so the deals climb with the camera.
  deal(ac, at, step) {
    const lift = 1 + step * 0.6
    sweep(ac, at, 0.15, 0.32, [[0, 1100 * lift], [0.15, 3600 * lift]], 1.3)
    tick(ac, at + 0.11, 0.12 + step * 0.08)
  },

  flip(ac, at) {
    sweep(ac, at, 0.42, 0.42, [[0, 450], [0.24, 2600], [0.42, 900]], 0.9, 'bandpass', 0.16)
    tick(ac, at + 0.4, 0.22)
    thump(ac, at + 0.4, 0.25, 140, 70, 0.1)
  },

  rise(ac, at) {
    sweep(ac, at, 0.95, 0.3, [[0, 280], [0.95, 3200]], 1.1, 'bandpass', 0.6)
  },

  chime(ac, at) {
    bell(ac, at, 88, 0.16, 1.1)
    bell(ac, at + 0.09, 95, 0.12, 1.3)
  },

  holo(ac, at) {
    sweep(ac, at, 0.3, 0.12, [[0, 2000], [0.3, 9000]], 0.6, 'highpass', 0.2)
    ;[84, 88, 91, 96, 100, 103].forEach((m, i) => bell(ac, at + 0.05 + i * 0.055, m, 0.14, 0.7))
  },

  secret(ac, at) {
    thump(ac, at, 0.6, 95, 38, 0.7)
    // A swell of detuned saws opening up underneath the sparkle.
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(260, at)
    lp.frequency.exponentialRampToValueAtTime(4200, at + 0.55)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.11, at + 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.9)
    lp.connect(g).connect(out!)
    for (const m of [57, 61, 64, 69]) {
      for (const cents of [-8, 8]) {
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(m)
        o.detune.value = cents
        o.connect(lp)
        o.start(at)
        o.stop(at + 2)
      }
    }
    ;[81, 85, 88, 93, 97, 100, 105].forEach((m, i) => bell(ac, at + 0.25 + i * 0.05, m, 0.13, 0.9, 0.8))
  },

  stamp(ac, at) {
    thump(ac, at, 0.75, 130, 45, 0.28)
    sweep(ac, at, 0.06, 0.4, [[0, 2600]], 0.7, 'lowpass', 0.002)
  },

  // Hard plastic giving way: a bright snap, the hollow knock of the case,
  // and a splinter of a tail.
  crack(ac, at) {
    sweep(ac, at, 0.03, 0.7, [[0, 3800]], 0.7, 'highpass', 0.001)
    sweep(ac, at + 0.004, 0.09, 0.45, [[0, 1100], [0.09, 700]], 4, 'bandpass', 0.002)
    thump(ac, at, 0.3, 240, 90, 0.07)
    tick(ac, at + 0.05, 0.18)
    tick(ac, at + 0.085, 0.1)
  },

  // The tool skating off the edge and the case knocking the table.
  slip(ac, at) {
    sweep(ac, at, 0.26, 0.4, [[0, 2600], [0.26, 420]], 1.6, 'bandpass', 0.01)
    thump(ac, at + 0.22, 0.5, 110, 50, 0.18)
  },
}

/** Plays one sound now, or `delayMs` from now. Silent when muted. */
export function playPackSound(name: PackSound, opts: { step?: number; delayMs?: number } = {}) {
  if (muted) return
  const ac = context()
  if (!ac || !out) return
  try {
    SOUNDS[name](ac, ac.currentTime + 0.01 + (opts.delayMs ?? 0) / 1000, opts.step ?? 0)
  } catch {
    // A sound is never worth breaking the reveal over.
  }
}
