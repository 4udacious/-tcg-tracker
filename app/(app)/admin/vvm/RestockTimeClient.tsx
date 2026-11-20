'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

/** The slider's range, in minutes, and where on it the scale bends: 1 to 20 minutes take the first two thirds of the track, 20 to 60 the rest. */
const LO = 1, MID = 20, HI = 60, BEND = 2 / 3, STEPS = 1000
/** Minutes at a point on the track (0-STEPS), and back. */
const toMin = (p: number) => Math.round(p / STEPS <= BEND ? LO + (p / STEPS / BEND) * (MID - LO) : MID + ((p / STEPS - BEND) / (1 - BEND)) * (HI - MID))
const toPos = (m: number) => Math.round(STEPS * (m <= MID ? ((m - LO) / (MID - LO)) * BEND : BEND + ((m - MID) / (HI - MID)) * (1 - BEND)))

// Two range inputs on one track: only their thumbs take pointer events, so either can be dragged.
const THUMBS = 'absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none focus:outline-none ' +
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-signal [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white ' +
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-signal [&::-moz-range-thumb]:cursor-pointer ' +
  'focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-signal/40'

const span = (lo: number, hi: number) => (lo === hi ? `${lo} min` : `${lo}–${hi} min`)

/**
 * How long the VVM stays on each stock (in stock or sold out) before it
 * restocks: a random length between the shortest and the longest, picked
 * afresh each time (set_vending_restock_time, v110). One slider, two handles.
 */
export default function RestockTimeClient({ minSeconds, maxSeconds }: { minSeconds: number; maxSeconds: number }) {
  const toast = useToast()
  const [range, setRange] = useState<[number, number]>([Math.round(minSeconds / 60), Math.round(maxSeconds / 60)])
  const [saved, setSaved] = useState(range)
  const [saving, setSaving] = useState(false)
  const [lo, hi] = range
  const at = (v: number) => (toPos(v) / STEPS) * 100
  const changed = lo !== saved[0] || hi !== saved[1]

  async function save() {
    setSaving(true)
    const { data, error } = await createClient().rpc('set_vending_restock_time', { p_min_minutes: lo, p_max_minutes: hi })
    setSaving(false)
    if (error) { toast.show(`Couldn't change it: ${error.message}`); return }
    const row = (Array.isArray(data) ? data[0] : data) as { min_seconds: number; max_seconds: number } | null
    const next: [number, number] = row ? [Math.round(row.min_seconds / 60), Math.round(row.max_seconds / 60)] : [lo, hi]
    setRange(next); setSaved(next)
    toast.show(`The VVM now restocks every ${span(...next)}, from the next restock.`)
  }

  return (
    <section className="space-y-2">
      <h2 className="font-display font-semibold text-base">Restock timing</h2>
      <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Time between restocks</p>
          <p className="text-xs font-mono text-muted shrink-0">{span(lo, hi)}</p>
        </div>
        <p className="text-xs text-muted leading-snug">
          How long the machine stays on each stock, in stock or sold out, before it restocks: a random length between the
          shortest and the longest, picked each time. Maintenance breaks stay 2–3 minutes. A change applies from the next restock.
        </p>
        <div className="relative h-8">
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-card-border" />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-signal"
            style={{ left: `calc(12px + (100% - 24px) * ${at(lo) / 100})`, right: `calc(12px + (100% - 24px) * ${1 - at(hi) / 100})` }}
          />
          <input
            type="range" min={0} max={STEPS} step={1} value={toPos(lo)}
            onChange={(e) => setRange([Math.min(toMin(Number(e.target.value)), hi), hi])}
            className={THUMBS}
            style={{ zIndex: lo >= HI - 1 ? 2 : 1 }}   // both at the far end: the shortest's handle on top, so it can come back down
            aria-label="Shortest time between restocks, in minutes"
          />
          <input
            type="range" min={0} max={STEPS} step={1} value={toPos(hi)}
            onChange={(e) => setRange([lo, Math.max(toMin(Number(e.target.value)), lo)])}
            className={THUMBS}
            aria-label="Longest time between restocks, in minutes"
          />
        </div>
        <div className="relative h-3 -mt-2 mx-3 text-[10px] text-muted">
          {[LO, 5, 10, MID, 40, HI].map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: `${at(m)}%` }}>{m}</span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">minutes</span>
          <div className="flex items-center gap-2">
            {changed && (
              <button type="button" onClick={() => setRange(saved)} className="text-xs text-muted hover:text-ink px-2 py-1">
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || !changed}
              className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1 hover:bg-signal/10 transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <span className="text-[11px] text-muted invisible">minutes</span>
        </div>
      </div>
    </section>
  )
}
