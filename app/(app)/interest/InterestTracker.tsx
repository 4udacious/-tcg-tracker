'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect, { type SelectOption } from '@/components/SearchableSelect'

interface Set {
  id: string
  name: string
  set_type: string
}

interface MyInterest {
  id: string
  note: string | null
  product_id: string
  created_at: string
  products: { id: string; name: string; sets: { id: string; name: string } | { id: string; name: string }[] | null } | { id: string; name: string; sets: { id: string; name: string } | { id: string; name: string }[] | null }[] | null
}

interface OthersWantItem {
  productId: string
  productName: string
  setName: string
  users: string[]
  count: number
}

interface BoardRow {
  productName: string
  count: number
  users: string[]
}

interface BoardSet {
  setName: string
  setType: string
  rows: BoardRow[]
}

interface Props {
  sets: Set[]
  myInterests: MyInterest[]
  othersWant: OthersWantItem[]
  interestBoard: BoardSet[]
  userId: string
}

export default function InterestTracker({ sets, myInterests, othersWant, interestBoard, userId }: Props) {
  const [showAllProducts, setShowAllProducts] = useState(false)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [products, setProducts] = useState<SelectOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const setOptions: SelectOption[] = sets.map((s) => ({ id: s.id, label: s.name }))

  async function handleSetChange(setId: string | null) {
    setSelectedSetId(setId)
    setSelectedProductId(null)
    setProducts([])
    if (!setId) return
    setLoadingProducts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('set_id', setId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
    setProducts((data ?? []).map((p) => ({ id: p.id, label: p.name })))
    setLoadingProducts(false)
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleTrack() {
    if (!selectedProductId) return
    const supabase = createClient()
    const { error } = await supabase
      .from('product_interest')
      .insert({ user_id: userId, product_id: selectedProductId, note: note || null })
    if (error) {
      if (error.code === '23505') {
        showToast('Already tracking.', false)
      } else {
        showToast('Something went wrong.', false)
      }
      return
    }
    showToast('Tracked!', true)
    setSelectedSetId(null)
    setSelectedProductId(null)
    setProducts([])
    setNote('')
    startTransition(() => router.refresh())
  }

  async function handleStopTracking(id: string) {
    const supabase = createClient()
    await supabase.from('product_interest').delete().eq('id', id)
    showToast('Stopped tracking.', true)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Add interest form */}
      <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
        <h2 className="font-display font-semibold text-base">Track this</h2>
        <SearchableSelect
          label="Set"
          options={setOptions}
          value={selectedSetId}
          onChange={handleSetChange}
          placeholder="Pick a set…"
        />
        <SearchableSelect
          label="Product"
          options={products}
          value={selectedProductId}
          onChange={setSelectedProductId}
          placeholder={loadingProducts ? 'Loading…' : selectedSetId ? 'Pick a product…' : 'Pick a set first'}
          disabled={!selectedSetId || loadingProducts}
        />
        <div className="space-y-1">
          <label className="text-sm font-medium text-ink">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Costco price"
            maxLength={200}
            className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
          />
        </div>
        <button
          onClick={handleTrack}
          disabled={!selectedProductId || isPending}
          className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
        >
          Track this
        </button>
      </section>

      {/* My requests */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">My Requests</h2>
        {myInterests.length === 0 ? (
          <p className="text-sm text-muted">Nothing tracked yet. Pick a set to start.</p>
        ) : (
          <ul className="space-y-2">
            {myInterests.map((item) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products
              const set = product
                ? Array.isArray((product as { sets: unknown }).sets)
                  ? ((product as { sets: { name: string }[] }).sets)[0]
                  : (product as { sets: { name: string } | null }).sets
                : null
              return (
                <li
                  key={item.id}
                  className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-sm truncate">{(product as { name: string } | null)?.name}</p>
                    <p className="font-mono text-xs text-muted">{(set as { name: string } | null)?.name}</p>
                    {item.note && (
                      <p className="text-xs text-muted italic">{item.note}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleStopTracking(item.id)}
                    className="shrink-0 text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors"
                  >
                    Stop tracking
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* What others want */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">What Others Want</h2>
        {othersWant.length === 0 ? (
          <p className="text-sm text-muted">No community requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {othersWant.map((item) => (
              <li
                key={item.productId}
                className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  <p className="font-mono text-xs text-muted">{item.setName}</p>
                  <p className="text-xs text-muted">{item.users.join(', ')}</p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-signal">
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Interest by set — signature board */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-base">Interest by Set</h2>
          <button
            onClick={() => setShowAllProducts((v) => !v)}
            className="font-mono text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors"
          >
            {showAllProducts ? 'Show wanted only' : 'Show all products'}
          </button>
        </div>
        {interestBoard.length === 0 ? (
          <p className="text-sm text-muted">No interest data yet.</p>
        ) : (
          <div className="space-y-4">
            {interestBoard.map((set) => {
              const visibleRows = showAllProducts ? set.rows : set.rows.filter((r) => r.count > 0)
              if (visibleRows.length === 0) return null
              return (
                <div key={set.setName} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-ink flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-white">{set.setName}</span>
                    {set.setType && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">{set.setType}</span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {visibleRows.map((row, idx) => (
                        <tr
                          key={row.productName}
                          className={`border-t border-card-border first:border-t-0 ${
                            idx === 0 && row.count > 0 ? 'bg-gradient-to-r from-signal/5 to-transparent' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium truncate max-w-[180px]">{row.productName}</p>
                            {row.users.length > 0 && (
                              <p className="text-xs text-muted truncate max-w-[220px]">{row.users.join(', ')}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono font-semibold ${row.count > 0 ? 'text-signal' : 'text-muted'}`}>
                              {row.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
