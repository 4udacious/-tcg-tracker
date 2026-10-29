'use client'

import { useSyncExternalStore } from 'react'

/**
 * Per-device preferences, kept in localStorage. Anything can read them with
 * useSettings(), or getSettings() outside React (the sound engine does), and
 * every change is broadcast so open components follow along.
 *
 * Battle text speed and advance mode are read by the battle screens; until
 * those land they are stored but have nothing to drive.
 */
export type Settings = {
  /** Pack, card and machine sound effects, 0-1 (0 is muted). */
  effectsVolume: number
  /** Battle music, 0-1. */
  musicVolume: number
  /** How fast battle text types out. */
  textSpeed: 'slow' | 'normal' | 'fast'
  /** Whether an announced move waits for a tap or moves on by itself. */
  advance: 'tap' | 'auto'
  /** Cut animations down: follow the device, or force on or off. */
  reduceMotion: 'system' | 'on' | 'off'
  /** Short vibrations on purchases, reveals and hits, where the phone supports it. */
  haptics: boolean
  /** Whether the app may ask for this device's location (Timers' "near me"). */
  location: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  effectsVolume: 0.8,
  musicVolume: 0.6,
  textSpeed: 'normal',
  advance: 'tap',
  reduceMotion: 'system',
  haptics: true,
  location: true,
}

const KEY = 'tcg-settings'
const listeners = new Set<() => void>()
let current: Settings = DEFAULT_SETTINGS
let loaded = false

function load(): Settings {
  if (loaded) return current
  loaded = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) current = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // Blocked storage: defaults for this visit.
  }
  return current
}

export function getSettings(): Settings {
  return typeof window === 'undefined' ? DEFAULT_SETTINGS : load()
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...load(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch {}
  listeners.forEach((f) => f())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f) } },
    getSettings,
    () => DEFAULT_SETTINGS,
  )
}

/** Subscribe outside React; returns the unsubscribe. */
export function onSettingsChange(f: () => void): () => void {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

/** A short buzz, if the phone can and the player hasn't turned haptics off. */
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator === 'undefined' || !getSettings().haptics) return
  try { navigator.vibrate?.(pattern) } catch {}
}
