'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MachineState {
  status: string
  cycle_no: number
  ends_at: string
  seconds_left: number
}

interface StockRow {
  pack_id: number
  set_name: string
  pack_name: string
  image_url: string
  quantity: number
}

interface Props {
  initialState: MachineState | null
  initialStock: StockRow[]
  balance: number
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VendingClient({ initialState, initialStock, balance }: Props) {
  const [state, setState] = useState<MachineState | null>(initialState)
  const [stock, setStock] = useState<StockRow[]>(initialStock)
  const [started, setStarted] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(initialState?.seconds_left ?? 0)
  const [refreshing, setRefreshing] = useState(false)
  const fetching = useRef(false)

  // Everyone holds the same `ends_at`, so every client reaches zero at the
  // same wall-clock moment and refetches together. That keeps the machine
  // globally in sync without needing realtime subscriptions.
  const refresh = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    setRefreshing(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('get_vending_state')
    const next = (Array.isArray(data) ? data[0] : data) as MachineState | null
    if (next) {
      setState(next)
      setSecondsLeft(next.seconds_left)
      if (next.status === 'in_stock' || next.status === 'out_of_stock') {
        const { data: s } = await supabase.rpc('get_vending_stock', { p_cycle: next.cycle_no })
        setStock((s as StockRow[]) ?? [])
      } else {
        setStock([])
      }
    }
    setRefreshing(false)
    fetching.current = false
  }, [])

  useEffect(() => {
    if (secondsLeft <= 0) { refresh(); return }
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [secondsLeft, refresh])

  // A tab left open in the background gets throttled, so re-sync on return.
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const status = state?.status ?? 'maintenance'
  const totalPacks = stock.reduce((n, s) => n + s.quantity, 0)

  return (
    <div className="space-y-4">
      {/* Balance strip */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display font-semibold text-base">Vending Machine</h1>
        <div className="flex items-center gap-1.5 bg-card border border-card-border rounded-full px-3 py-1">
          <span className="font-mono text-sm font-semibold text-signal">{balance}</span>
          <span className="text-xs text-muted">{balance === 1 ? 'token' : 'tokens'}</span>
        </div>
      </div>

      {/* ── The machine ── */}
      <div className="mx-auto w-full max-w-sm">
        <div className="relative rounded-[2rem] bg-[#f2f2f0] p-3 pt-0 shadow-[0_0_0_3px_#ff3b53,0_0_28px_rgba(255,59,83,0.45)]">
          {/* Pokéball crown */}
          <div className="flex justify-center -mt-6 mb-3">
            <div className="w-20 h-20 rounded-full border-[3px] border-[#ff3b53] overflow-hidden shadow-[0_0_18px_rgba(255,59,83,0.5)] bg-white">
              <div className="h-1/2 bg-[#e03040]" />
              <div className="h-[3px] bg-black" />
              <div className="h-1/2 bg-[#f7f7f5]" />
              <div className="absolute left-1/2 top-[1.15rem] -translate-x-1/2 w-6 h-6 rounded-full bg-white border-[3px] border-black" />
            </div>
          </div>

          {/* Screen */}
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black border-2 border-black">
            {!started ? (
              <AttractScreen onStart={() => setStarted(true)} />
            ) : status === 'in_stock' ? (
              <StockScreen stock={stock} soldOut={false} />
            ) : status === 'out_of_stock' ? (
              <StockScreen stock={stock} soldOut />
            ) : status === 'blacked_out' ? (
              <BlackoutScreen />
            ) : (
              <MaintenanceScreen />
            )}
          </div>

          {/* Dispensing tray */}
          <div className="mt-3 h-10 rounded-xl bg-[#111] border-[3px] border-[#ff3b53] shadow-[inset_0_4px_14px_rgba(0,0,0,0.8)]" />
        </div>
      </div>

      {/* ── Status line ── */}
      {started && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {status === 'in_stock' && `Stocked — ${totalPacks} pack${totalPacks === 1 ? '' : 's'}`}
              {status === 'out_of_stock' && 'Sold out'}
              {status === 'blacked_out' && 'Machine is dark'}
              {status === 'maintenance' && 'Under maintenance'}
            </p>
            <p className="font-mono text-[10px] text-muted">
              {refreshing ? 'syncing…' : `changes in ${mmss(secondsLeft)} · cycle #${state?.cycle_no ?? '—'}`}
            </p>
          </div>
          <button
            onClick={refresh}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border hover:border-ink/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {started && status === 'in_stock' && (
        <p className="mx-auto w-full max-w-sm text-center text-xs text-muted">
          Checkout is coming next — for now the machine is view-only.
        </p>
      )}
    </div>
  )
}

/* ────────────────────────────── screens ────────────────────────────── */

function AttractScreen({ onStart }: { onStart: () => void }) {
  return (
    <button
      onClick={onStart}
      className="absolute inset-0 w-full h-full flex flex-col bg-gradient-to-b from-[#dff1fb] to-[#bfe4f7] focus:outline-none"
    >
      <div className="px-3 pt-3">
        <div className="rounded bg-[#c82030] text-white text-[9px] font-bold tracking-wide py-0.5">NOTICE</div>
        <p className="mt-1 text-[7px] leading-tight text-ink/70">
          One transaction at a time. Please collect your packs from the tray below before the next trainer steps up.
        </p>
      </div>

      {/* drifting pack art */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center gap-3 animate-[drift_18s_linear_infinite] will-change-transform">
          {['base-set-charizard','jungle-scyther','fossil-lapras','team-rocket-giovanni','base-set-venusaur','fossil-zapdos','jungle-flareon','team-rocket-dark-gyarados'].map((f, i) => (
            <img key={i} src={`/packs/${f}.webp`} alt="" className="h-24 w-auto shrink-0 drop-shadow-md" />
          ))}
        </div>
      </div>

      <div className="m-2 rounded bg-[#f5c518] py-2 text-center text-ink font-extrabold text-sm tracking-wide shadow animate-pulse">
        TOUCH TO START
      </div>

      <style>{`
        @keyframes drift { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[drift_18s_linear_infinite\\] { animation: none }
        }
      `}</style>
    </button>
  )
}

function StockScreen({ stock, soldOut }: { stock: StockRow[]; soldOut: boolean }) {
  if (stock.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#eaf4fb] flex items-center justify-center p-4">
        <p className="text-xs text-ink/60 text-center">No listing for this cycle.</p>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 bg-[#eaf4fb] overflow-y-auto p-2">
      <div className="grid grid-cols-3 gap-1.5">
        {stock.map((s) => (
          <div key={s.pack_id} className="relative rounded bg-white border border-black/10 p-1">
            <img
              src={s.image_url}
              alt={`${s.set_name} — ${s.pack_name}`}
              className={`w-full aspect-[2/3] object-contain ${soldOut ? 'opacity-60 grayscale-[35%]' : ''}`}
              loading="lazy"
            />
            <p className="mt-0.5 text-[6px] leading-tight text-ink/70 text-center truncate">{s.pack_name}</p>

            {soldOut ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rotate-[-8deg] bg-black/80 text-white text-[7px] font-extrabold tracking-wider px-2 py-0.5 shadow">
                  SOLD OUT
                </span>
              </div>
            ) : (
              <span className="absolute top-0.5 right-0.5 rounded-full bg-[#c82030] text-white text-[7px] font-bold px-1">
                {s.quantity}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function BlackoutScreen() {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      {/* faint reflection, like a dead screen catching the room */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-white/[0.03]" />
      <p className="relative font-mono text-[10px] text-white/20 tracking-widest">NO SIGNAL</p>
    </div>
  )
}

function MaintenanceScreen() {
  return (
    <div className="absolute inset-0 bg-[#0d2b45] flex flex-col items-center justify-center gap-3 p-4 text-center">
      <svg className="w-10 h-10 text-[#f5c518]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
      <p className="text-white font-semibold text-sm">Under maintenance</p>
      <p className="text-white/50 text-[10px] leading-relaxed">
        This machine is being serviced. Please check back shortly.
      </p>
    </div>
  )
}
