'use client'

import { useMemo, useState, useTransition } from 'react'
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

interface Person {
  id: string
  label: string
}

interface PersonItem {
  productName: string
  setName: string
  note: string | null
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
  peopleList: Person[]
  interestsByPerson: Record<string, PersonItem[]>
  interestBoard: BoardSet[]
  userId: string
}

type Tab = 'track' | 'byPerson' | 'bySet'

export default function InterestTracker({ sets, myInterests, peopleList, interestsByPerson, interestBoard, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [tab, setTab] = useState<Tab>('track')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [expandedWho, setExpandedWho] = useState<globalThis.Set<string>>(new globalThis.Set())

  function toggleWho(productName: string) {
    setExpandedWho((prev: globalThis.Set<string>) => {
      const next = new globalThis.Set(prev)
      if (next.has(productName)) next.delete(productName)
      else next.add(productName)
      return next
    })
  }

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [products, setProducts] = useState<SelectOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [productFilter, setProductFilter] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const filteredProducts = productFilter.trim()
    ? products.filter((p) => p.label.toLowerCase().includes(productFilter.toLowerCase()))
    : products

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedBoardSetName, setSelectedBoardSetName] = useState<string | null>(null)

  const setOptions: SelectOption[] = sets.map((s) => ({ id: s.id, label: s.name }))
  const personOptions: SelectOption[] = peopleList.map((p) => ({ id: p.id, label: p.label }))
  const boardSetOptions: SelectOption[] = interestBoard.map((s) => ({ id: s.setName, label: s.setName }))

  const selectedPersonItems = selectedPersonId ? interestsByPerson[selectedPersonId] ?? [] : []
  const selectedBoardSet = interestBoard.find((s) => s.setName === selectedBoardSetName) ?? null

  async function handleSetChange(setId: string | null) {
    setSelectedSetId(setId)
    setSelectedProductIds([])
    setProductFilter('')
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
    if (selectedProductIds.length === 0) return
    const supabase = createClient()
    const singleNote = selectedProductIds.length === 1 ? note.trim() || null : null
    const rows = selectedProductIds.map((productId) => ({
      user_id: userId,
      product_id: productId,
      note: singleNote,
    }))
    const { data, error } = await supabase
      .from('product_interest')
      .upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
      .select('id')
    if (error) {
      showToast('Something went wrong.', false)
      return
    }
    const addedCount = data?.length ?? 0
    const skipped = rows.length - addedCount
    if (addedCount === 0) {
      showToast(rows.length === 1 ? 'Already tracking.' : 'Already tracking all of those.', false)
    } else if (skipped > 0) {
      showToast(`Tracked ${addedCount}, already tracking ${skipped}.`, true)
    } else {
      showToast(addedCount === 1 ? 'Tracked!' : `Tracked ${addedCount} items!`, true)
    }
    setSelectedSetId(null)
    setSelectedProductIds([])
    setProductFilter('')
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

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: 'track', label: 'Track' },
      { id: 'byPerson', label: 'By Person' },
      { id: 'bySet', label: 'By Set' },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'track' && (
        <>
          <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
            <h2 className="font-display font-semibold text-base">Track this</h2>
            <SearchableSelect
              label="Set"
              options={setOptions}
              value={selectedSetId}
              onChange={handleSetChange}
              placeholder="Pick a set…"
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">
                Product{selectedProductIds.length > 0 ? ` (${selectedProductIds.length} selected)` : ''}
              </label>
              {!selectedSetId ? (
                <p className="text-sm text-muted bg-paper border border-card-border rounded-xl px-3 py-2.5">Pick a set first</p>
              ) : loadingProducts ? (
                <p className="text-sm text-muted bg-paper border border-card-border rounded-xl px-3 py-2.5">Loading…</p>
              ) : (
                <div className="border border-card-border rounded-xl overflow-hidden">
                  <input
                    type="text"
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    placeholder="Type to filter…"
                    className="w-full text-sm bg-paper px-3 py-2 outline-none placeholder:text-muted border-b border-card-border"
                  />
                  <ul className="max-h-52 overflow-y-auto divide-y divide-card-border">
                    {filteredProducts.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted">No products</li>
                    ) : (
                      filteredProducts.map((p) => (
                        <li key={p.id}>
                          <label className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-paper transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="accent-signal w-4 h-4 rounded shrink-0"
                            />
                            <span className="text-ink">{p.label}</span>
                          </label>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
            {selectedProductIds.length === 1 ? (
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
            ) : selectedProductIds.length > 1 ? (
              <p className="text-xs text-muted italic">Notes can only be added when tracking a single item.</p>
            ) : null}
            <button
              onClick={handleTrack}
              disabled={selectedProductIds.length === 0 || isPending}
              className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              {selectedProductIds.length > 1 ? `Track ${selectedProductIds.length} items` : 'Track this'}
            </button>
          </section>

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
                        {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
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
        </>
      )}

      {tab === 'byPerson' && (
        <section className="space-y-4">
          <SearchableSelect
            label="Person"
            options={personOptions}
            value={selectedPersonId}
            onChange={setSelectedPersonId}
            placeholder="Pick a person…"
          />
          {!selectedPersonId ? (
            <p className="text-sm text-muted">Pick a person to see what they&apos;re tracking.</p>
          ) : selectedPersonItems.length === 0 ? (
            <p className="text-sm text-muted">Nothing tracked by this person yet.</p>
          ) : (
            <ul className="space-y-2">
              {selectedPersonItems.map((item, i) => (
                <li key={i} className="bg-card border border-card-border rounded-xl px-4 py-3 space-y-0.5">
                  <p className="font-medium text-sm">{item.productName}</p>
                  <p className="font-mono text-xs text-muted">{item.setName}</p>
                  {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'bySet' && (
        <section className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SearchableSelect
                label="Set"
                options={boardSetOptions}
                value={selectedBoardSetName}
                onChange={setSelectedBoardSetName}
                placeholder="Pick a set…"
              />
            </div>
            <button
              onClick={() => setShowAllProducts((v) => !v)}
              className="shrink-0 font-mono text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors pb-2.5"
            >
              {showAllProducts ? 'Wanted only' : 'Show all'}
            </button>
          </div>

          {!selectedBoardSet ? (
            <p className="text-sm text-muted">Pick a set to see who wants what.</p>
          ) : (
            (() => {
              const visibleRows = showAllProducts ? selectedBoardSet.rows : selectedBoardSet.rows.filter((r) => r.count > 0)
              if (visibleRows.length === 0) {
                return <p className="text-sm text-muted">No interest in this set yet.</p>
              }
              return (
                <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-ink flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-white">{selectedBoardSet.setName}</span>
                    {selectedBoardSet.setType && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">{selectedBoardSet.setType}</span>
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
                            <p className={`font-medium leading-snug break-words ${row.productName.length > 26 ? 'text-xs' : 'text-sm'}`}>
                              {row.productName}
                            </p>
                            {row.users.length > 0 && (
                              <WhoCell
                                users={row.users}
                                expanded={expandedWho.has(row.productName)}
                                onToggle={() => toggleWho(row.productName)}
                              />
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
            })()
          )}
        </section>
      )}
    </div>
  )
}

const WHO_PREVIEW_COUNT = 2

function WhoCell({ users, expanded, onToggle }: { users: string[]; expanded: boolean; onToggle: () => void }) {
  const hasMore = users.length > WHO_PREVIEW_COUNT

  if (!hasMore) {
    return <p className="text-xs text-muted truncate max-w-[220px]">{users.join(', ')}</p>
  }

  if (expanded) {
    return (
      <p className="text-xs text-muted">
        {users.join(', ')}{' '}
        <button
          type="button"
          onClick={onToggle}
          className="font-semibold text-signal"
          aria-label="Show fewer names"
        >
          −
        </button>
      </p>
    )
  }

  const remaining = users.length - WHO_PREVIEW_COUNT
  return (
    <p className="text-xs text-muted truncate max-w-[220px]">
      {users.slice(0, WHO_PREVIEW_COUNT).join(', ')}{' '}
      <button
        type="button"
        onClick={onToggle}
        className="font-semibold text-signal"
        aria-label={`Show ${remaining} more`}
      >
        +{remaining}
      </button>
    </p>
  )
}
