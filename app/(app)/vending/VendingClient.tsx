'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MachineState {
  status: string
  cycle_no: number
  ends_at: string
  seconds_left: number
  frozen: boolean
  holder_id: string | null
  holder_name: string | null
  holder_expires: string | null
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
  userId: string
  cooldownUntil: string | null
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = Math.max(0, total % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function untilLabel(iso: string): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default function VendingClient({ initialState, initialStock, balance, userId, cooldownUntil }: Props) {
  const [state, setState] = useState<MachineState | null>(initialState)
  const [stock, setStock] = useState<StockRow[]>(initialStock)
  const [tokens, setTokens] = useState(balance)
  const [cooldown, setCooldown] = useState<string | null>(cooldownUntil)
  const [secondsLeft, setSecondsLeft] = useState(initialState?.seconds_left ?? 0)
  const [cart, setCart] = useState<Record<number, number>>({})
  const [holdLeft, setHoldLeft] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ packs: number; restocked: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const fetching = useRef(false)

  const iAmHolder = !!state?.holder_id && state.holder_id === userId
  const status = state?.status ?? 'maintenance'
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  const refresh = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
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
      if (next.holder_id !== userId) setCart({})
    }
    fetching.current = false
  }, [userId])

  // The cycle clock. Frozen while somebody holds the machine, so it simply
  // stops ticking rather than needing special-casing here.
  useEffect(() => {
    if (state?.frozen) return
    if (secondsLeft <= 0) { refresh(); return }
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [secondsLeft, state?.frozen, refresh])

  // Poll while someone else is using the machine, so waiting users see it
  // free up without having to mash refresh.
  useEffect(() => {
    if (!state?.holder_id || iAmHolder) return
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [state?.holder_id, iAmHolder, refresh])

  // My own hold countdown, plus a heartbeat so the minute is one of
  // *inactivity* rather than a hard cap.
  useEffect(() => {
    if (!iAmHolder || !state?.holder_expires) return
    const tick = setInterval(() => {
      const left = Math.round((new Date(state.holder_expires!).getTime() - Date.now()) / 1000)
      setHoldLeft(Math.max(0, left))
      if (left <= 0) { setCart({}); refresh() }
    }, 500)
    return () => clearInterval(tick)
  }, [iAmHolder, state?.holder_expires, refresh])

  const beat = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('vending_heartbeat')
    if (data) setState((s) => (s ? { ...s, holder_expires: data as string } : s))
  }, [])

  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // Release the machine if the holder navigates away, rather than making
  // everyone wait out the full timeout.
  useEffect(() => {
    if (!iAmHolder) return
    function release() {
      const supabase = createClient()
      supabase.rpc('vending_release')
    }
    window.addEventListener('pagehide', release)
    return () => { window.removeEventListener('pagehide', release) }
  }, [iAmHolder])

  async function claim() {
    setBusy(true); setMessage(null); setReceipt(null)
    const supabase = createClient()
    const { data } = await supabase.rpc('vending_claim')
    const r = (Array.isArray(data) ? data[0] : data) as
      | { ok: boolean; reason: string; holder_name: string | null; expires_at: string | null }
      | null
    if (r?.ok) {
      await refresh()
    } else {
      switch (r?.reason) {
        case 'busy': setMessage(`${r.holder_name} beat you to the machine.`); break
        case 'cooldown': setMessage(`You just bought. Back in ${r.expires_at ? untilLabel(r.expires_at) : 'a while'}.`); break
        case 'not_stocked': setMessage('Nothing to buy right now.'); break
        case 'no_tokens': setMessage('You have no tokens left this month.'); break
        case 'empty': setMessage('The machine is cleared out.'); break
        default: setMessage('Could not start a session.')
      }
      await refresh()
    }
    setBusy(false)
  }

  function addToCart(s: StockRow, delta: number) {
    setCart((c) => {
      const cur = c[s.pack_id] ?? 0
      const next = Math.min(s.quantity, Math.max(0, cur + delta))
      const copy = { ...c }
      if (next === 0) delete copy[s.pack_id]
      else copy[s.pack_id] = next
      return copy
    })
    beat()
  }

  async function checkout() {
    if (cartCount === 0) return
    setBusy(true); setMessage(null)
    const supabase = createClient()
    const items = Object.entries(cart).map(([pack_id, qty]) => ({ pack_id: Number(pack_id), qty }))
    const { data } = await supabase.rpc('vending_checkout', { p_items: items })
    const r = (Array.isArray(data) ? data[0] : data) as
      | { ok: boolean; reason: string; packs_bought: number; balance: number; restocked: boolean }
      | null
    if (r?.ok) {
      setTokens(r.balance)
      setCart({})
      setReceipt({ packs: r.packs_bought, restocked: r.restocked })
      setCooldown(new Date(Date.now() + 3 * 3600_000).toISOString())
    } else {
      switch (r?.reason) {
        case 'not_holder': setMessage('Your session timed out.'); break
        case 'insufficient_stock': setMessage('Someone got there first — stock changed.'); break
        case 'insufficient_tokens': setMessage('Not enough tokens.'); break
        default: setMessage('Checkout failed.')
      }
    }
    await refresh()
    setBusy(false)
  }

  const onCooldown = !!cooldown && new Date(cooldown).getTime() > Date.now()
  const someoneElse = !!state?.holder_id && !iAmHolder

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display font-semibold text-base">Vending Machine</h1>
        <div className="flex items-center gap-1.5 bg-card border border-card-border rounded-full px-3 py-1">
          <span className="font-mono text-sm font-semibold text-signal">{tokens}</span>
          <span className="text-xs text-muted">{tokens === 1 ? 'token' : 'tokens'}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <div className="relative rounded-[2rem] bg-[#f2f2f0] p-3 pt-0 shadow-[0_0_0_3px_#ff3b53,0_0_28px_rgba(255,59,83,0.45)]">
          <div className="flex justify-center -mt-6 mb-3">
            <div className="relative w-20 h-20 rounded-full border-[3px] border-[#ff3b53] overflow-hidden shadow-[0_0_18px_rgba(255,59,83,0.5)] bg-white">
              <div className="h-1/2 bg-[#e03040]" />
              <div className="h-[3px] bg-black" />
              <div className="h-1/2 bg-[#f7f7f5]" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-[3px] border-black" />
            </div>
          </div>

          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black border-2 border-black">
            {receipt ? (
              <DispensingScreen packs={receipt.packs} restocked={receipt.restocked} />
            ) : status === 'blacked_out' ? (
              <BlackoutScreen />
            ) : status === 'maintenance' ? (
              <MaintenanceScreen />
            ) : status === 'out_of_stock' ? (
              <StockScreen stock={stock} soldOut cart={{}} onAdd={() => {}} interactive={false} />
            ) : iAmHolder ? (
              <StockScreen stock={stock} soldOut={false} cart={cart} onAdd={addToCart} interactive />
            ) : (
              <AttractScreen
                onStart={claim}
                busy={busy}
                lockedBy={someoneElse ? state!.holder_name : null}
              />
            )}
          </div>

          <div className="mt-3 h-10 rounded-xl bg-[#111] border-[3px] border-[#ff3b53] shadow-[inset_0_4px_14px_rgba(0,0,0,0.8)]" />
        </div>
      </div>

      {message && (
        <p className="mx-auto w-full max-w-sm text-center text-sm font-medium text-signal bg-signal/10 border border-signal/30 rounded-xl px-3 py-2">
          {message}
        </p>
      )}

      {/* Holder controls */}
      {iAmHolder && !receipt && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {cartCount === 0 ? 'Pick your packs' : `${cartCount} pack${cartCount === 1 ? '' : 's'} · ${cartCount} token${cartCount === 1 ? '' : 's'}`}
            </p>
            <span className={`font-mono text-xs ${holdLeft <= 15 ? 'text-red-500' : 'text-muted'}`}>
              {mmss(holdLeft)} left
            </span>
          </div>
          {cartCount > tokens && (
            <p className="text-xs text-red-500">That is more than you can afford.</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={checkout}
              disabled={busy || cartCount === 0 || cartCount > tokens}
              className="flex-1 bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              Check out
            </button>
            <button
              onClick={async () => { const s = createClient(); await s.rpc('vending_release'); setCart({}); refresh() }}
              className="px-4 border border-card-border rounded-xl text-sm font-medium text-muted hover:text-ink transition-colors"
            >
              Leave
            </button>
          </div>
          <p className="text-[10px] text-muted">
            The machine is yours while you are active. The status clock is paused, so nothing changes under you.
          </p>
        </div>
      )}

      {receipt && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl p-4 space-y-2 text-center">
          <p className="text-sm font-medium">Collected {receipt.packs} pack{receipt.packs === 1 ? '' : 's'}.</p>
          {receipt.restocked && <p className="text-xs text-signal font-medium">The machine restocked behind you.</p>}
          <p className="text-xs text-muted">Back in 3 hours.</p>
          <button onClick={() => setReceipt(null)} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
            Done
          </button>
        </div>
      )}

      {/* Status line */}
      {!iAmHolder && !receipt && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {someoneElse
                ? `${state!.holder_name} is at the machine`
                : status === 'in_stock' ? `Stocked — ${stock.reduce((n, s) => n + s.quantity, 0)} packs`
                : status === 'out_of_stock' ? 'Sold out'
                : status === 'blacked_out' ? 'Machine is dark'
                : 'Under maintenance'}
            </p>
            <p className="font-mono text-[10px] text-muted">
              {state?.frozen ? 'clock paused' : `changes in ${mmss(secondsLeft)}`} · cycle #{state?.cycle_no ?? '—'}
              {onCooldown && ` · your cooldown ${untilLabel(cooldown!)}`}
            </p>
          </div>
          <button onClick={refresh} className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border hover:border-ink/30 transition-colors">
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────── screens ────────────────────────────── */

function AttractScreen({ onStart, busy, lockedBy }: { onStart: () => void; busy: boolean; lockedBy: string | null }) {
  return (
    <button
      onClick={onStart}
      disabled={busy || !!lockedBy}
      className="absolute inset-0 w-full h-full flex flex-col bg-gradient-to-b from-[#dff1fb] to-[#bfe4f7] focus:outline-none disabled:cursor-not-allowed"
    >
      <div className="px-3 pt-3">
        <div className="rounded bg-[#c82030] text-white text-[9px] font-bold tracking-wide py-0.5">NOTICE</div>
        <p className="mt-1 text-[7px] leading-tight text-ink/70">
          One trainer at a time. Collect your packs from the tray before the next person steps up.
        </p>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center gap-3 animate-[drift_18s_linear_infinite] will-change-transform">
          {['base-set-charizard','jungle-scyther','fossil-lapras','team-rocket-giovanni','base-set-venusaur','fossil-zapdos','jungle-flareon','team-rocket-dark-gyarados'].map((f, i) => (
            <img key={i} src={`/packs/${f}.webp`} alt="" className="h-24 w-auto shrink-0 drop-shadow-md" />
          ))}
        </div>
      </div>

      <div className={`m-2 rounded py-2 text-center font-extrabold text-sm tracking-wide shadow ${
        lockedBy ? 'bg-black/70 text-white/80' : 'bg-[#f5c518] text-ink animate-pulse'
      }`}>
        {lockedBy ? `${lockedBy.toUpperCase()} IS USING IT` : busy ? 'STARTING…' : 'TOUCH TO START'}
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

function StockScreen({
  stock, soldOut, cart, onAdd, interactive,
}: {
  stock: StockRow[]
  soldOut: boolean
  cart: Record<number, number>
  onAdd: (s: StockRow, delta: number) => void
  interactive: boolean
}) {
  if (stock.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#eaf4fb] flex items-center justify-center p-4">
        <p className="text-xs text-ink/60 text-center">Cleared out.</p>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 bg-[#eaf4fb] overflow-y-auto p-2">
      <div className="grid grid-cols-3 gap-1.5">
        {stock.map((s) => {
          const taken = cart[s.pack_id] ?? 0
          const gone = s.quantity === 0
          return (
            <div key={s.pack_id} className="relative rounded bg-white border border-black/10 p-1">
              <img
                src={s.image_url}
                alt={`${s.set_name} — ${s.pack_name}`}
                className={`w-full aspect-[2/3] object-contain ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`}
                loading="lazy"
              />
              <p className="mt-0.5 text-[6px] leading-tight text-ink/70 text-center truncate">{s.pack_name}</p>

              {soldOut || gone ? (
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

              {interactive && !gone && (
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  <button
                    onClick={() => onAdd(s, -1)}
                    disabled={taken === 0}
                    className="w-4 h-4 rounded bg-black/10 text-ink text-[9px] leading-none disabled:opacity-30"
                    aria-label={`Remove one ${s.pack_name}`}
                  >
                    −
                  </button>
                  <span className="font-mono text-[8px] w-3 text-center">{taken}</span>
                  <button
                    onClick={() => onAdd(s, 1)}
                    disabled={taken >= s.quantity}
                    className="w-4 h-4 rounded bg-[#c82030] text-white text-[9px] leading-none disabled:opacity-30"
                    aria-label={`Add one ${s.pack_name}`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DispensingScreen({ packs, restocked }: { packs: number; restocked: boolean }) {
  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-2 p-4 text-center">
      <p className="text-[10px] font-semibold tracking-wide text-ink/70">COLLECTING</p>
      <p className="text-sm font-bold text-ink">{packs} OF {packs} TOTAL ITEMS</p>
      <div className="my-2 h-px w-3/4 bg-black/20" />
      <p className="text-[10px] text-ink/50">PLEASE WAIT</p>
      {restocked && <p className="mt-2 text-[9px] font-semibold text-[#c82030]">RESTOCKING…</p>}
    </div>
  )
}

function BlackoutScreen() {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
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
